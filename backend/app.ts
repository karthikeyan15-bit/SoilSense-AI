import crypto from 'crypto';
import cors from 'cors';
import express, { type Express, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type {
  AreaUnit,
  ChatMessageRecord,
  ChatSessionRecord,
  CropSeason,
  Farm,
  FertilizerLineItem,
  FertilizerRecommendationRecord,
  GrowthStage,
  ReportRecord,
  SoilAnalysisRecord,
  SoilMeasurementInput,
  SupportedLanguage,
  UserProfile,
} from '../shared/types.js';
import {
  DATASET_REGISTRY,
  FERTILIZER_PRODUCTS,
  INDIA_DISTRICTS,
  INDIAN_STATES,
  SUPPORTED_CROPS,
} from './data/agronomicData.js';
import {
  getDatabase,
  getPersistenceMode,
  hashPassword,
  queryAll,
  queryOne,
  runStatement,
  verifyPassword,
} from './db/database.js';
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AuthenticatedRequest,
} from './middleware/auth.js';
import {
  extractSoilReportWithGemini,
  generateGroundedAgronomicAnswer,
} from './services/aiService.js';
import { runKarnatakaDatasetValidation } from './services/datasetPreprocessor.js';
import { calculateFertilizerRecommendation } from './services/fertilizerService.js';
import { buildAdvisoryPdfBuffer } from './services/reportService.js';
import {
  convertAreaToHectares,
  createSampleFingerprint,
  evaluateCropSuitability,
  evaluateSoilAnalysis,
  validateSoilMeasurements,
} from './services/soilService.js';
import { getWeatherAdvisoryForDistrict } from './services/weatherService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().trim().optional(),
  preferredLanguage: z.enum(['en', 'kn', 'ta', 'te', 'hi']).default('en'),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const farmSchema = z.object({
  farmName: z.string().trim().min(2, 'Farm name is required'),
  state: z.string().trim().min(2, 'State / UT is required').default('Punjab'),
  district: z.string().trim().min(2, 'District is required'),
  village: z.string().trim().min(1, 'Village is required'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  landArea: z.number().positive('Land area must be greater than zero'),
  areaUnit: z.enum(['hectare', 'acre', 'gunta', 'bigha']).default('acre'),
  selectedCrop: z.string().trim().min(2),
  cropSeason: z.enum(['Kharif', 'Rabi', 'Summer', 'Annual']).default('Kharif'),
  growthStage: z
    .enum([
      'Pre-sowing / Basal',
      'Vegetative / Tillering',
      'Flowering / Panicle',
      'Grain Filling / Maturity',
    ])
    .default('Pre-sowing / Basal'),
  soilType: z.string().trim().optional(),
});

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function mapFarmRow(row: Record<string, unknown>): Farm {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    farmName: String(row.farm_name),
    state: String(row.state),
    district: String(row.district),
    village: String(row.village),
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    landArea: Number(row.land_area),
    areaUnit: row.area_unit as AreaUnit,
    areaHectares: Number(row.area_hectares),
    selectedCrop: String(row.selected_crop),
    cropSeason: row.crop_season as CropSeason,
    growthStage: row.growth_stage as GrowthStage,
    soilType: row.soil_type ? String(row.soil_type) : undefined,
    createdAt: String(row.created_at),
  };
}

async function getUserProfileById(userId: string): Promise<UserProfile | null> {
  const db = await getDatabase();
  const row = queryOne<Record<string, unknown>>(
    db,
    `SELECT u.id, u.name, u.email, u.role, u.created_at, p.phone, p.preferred_language
     FROM users u
     LEFT JOIN farmer_profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId],
  );
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : '',
    preferredLanguage: (row.preferred_language as SupportedLanguage) || 'en',
    role: (row.role as UserProfile['role']) || 'farmer',
    createdAt: String(row.created_at),
  };
}

async function fetchAnalysisRecord(analysisId: string, userId: string): Promise<SoilAnalysisRecord | null> {
  const db = await getDatabase();
  const row = queryOne<Record<string, unknown>>(
    db,
    `SELECT a.*, s.sample_date, s.sample_depth, s.lab_name, s.extraction_method, s.verification_status,
            f.farm_name, f.state, f.district
     FROM soil_analyses a
     JOIN soil_samples s ON s.id = a.soil_sample_id
     JOIN farms f ON f.id = a.farm_id
     WHERE a.id = ? AND a.user_id = ?`,
    [analysisId, userId],
  );
  if (!row) return null;

  const measurementRows = queryAll<Record<string, unknown>>(
    db,
    `SELECT parameter_name, measured_value, unit, method FROM soil_measurements WHERE soil_sample_id = ?`,
    [String(row.soil_sample_id)],
  );

  return {
    id: String(row.id),
    soilSampleId: String(row.soil_sample_id),
    farmId: String(row.farm_id),
    farmName: String(row.farm_name),
    state: row.state ? String(row.state) : undefined,
    district: String(row.district),
    crop: String(row.crop),
    sampleDate: String(row.sample_date),
    sampleDepth: String(row.sample_depth),
    labName: String(row.lab_name),
    extractionMethod: String(row.extraction_method),
    verificationStatus: (row.verification_status as 'verified' | 'pending_review') || 'verified',
    measurements: measurementRows.map((m) => ({
      parameterName: m.parameter_name as SoilMeasurementInput['parameterName'],
      measuredValue: m.measured_value !== null && m.measured_value !== undefined ? Number(m.measured_value) : null,
      unit: String(m.unit),
      method: m.method ? String(m.method) : undefined,
    })),
    assessments: JSON.parse(String(row.nutrient_status_json)),
    missingParameters: JSON.parse(String(row.missing_parameters_json)),
    overallHealthSummary: String(row.analysis_summary),
    deficienciesCount: Number(row.deficiencies_count),
    excessCount: Number(row.excess_count),
    sufficientCount: Number(row.sufficient_count),
    sourceReferences: JSON.parse(String(row.source_references_json)),
    createdAt: String(row.created_at),
  };
}

async function fetchRecommendationRecord(
  recId: string,
  userId: string,
): Promise<FertilizerRecommendationRecord | null> {
  const db = await getDatabase();
  const row = queryOne<Record<string, unknown>>(
    db,
    `SELECT r.*, f.farm_name, f.state, f.district
     FROM fertilizer_recommendations r
     JOIN farms f ON f.id = r.farm_id
     WHERE r.id = ? AND r.user_id = ?`,
    [recId, userId],
  );
  if (!row) return null;

  const lineRows = queryAll<Record<string, unknown>>(
    db,
    `SELECT * FROM fertilizer_line_items WHERE recommendation_id = ?`,
    [recId],
  );

  const lineItems: FertilizerLineItem[] = lineRows.map((l) => ({
    id: String(l.id),
    fertilizerProductId: String(l.fertilizer_product_id),
    productName: String(l.product_name),
    gradeLabel: String(l.grade_label),
    quantityPerHectareKg: Number(l.quantity_per_hectare),
    totalQuantityKg: Number(l.total_quantity),
    bagWeightKg: Number(l.bag_weight_kg),
    totalBags: Number(l.total_bags),
    pricePerBagInr: Number(l.price_per_bag_inr),
    estimatedPriceInr: Number(l.estimated_price),
    nutrientsContributedKgPerHa: JSON.parse(String(l.nutrients_contributed_json)),
  }));

  return {
    id: String(row.id),
    soilAnalysisId: String(row.soil_analysis_id),
    farmId: String(row.farm_id),
    farmName: String(row.farm_name),
    state: row.state ? String(row.state) : undefined,
    district: String(row.district),
    crop: String(row.crop),
    season: row.season as CropSeason,
    growthStage: row.growth_stage as GrowthStage,
    landAreaHectares: Number(row.land_area_hectares),
    landAreaDisplay: String(row.land_area_display),
    status: row.status as 'calculated' | 'expert_review_required',
    expertReviewReason: row.expert_review_reason ? String(row.expert_review_reason) : undefined,
    missingInformation: row.missing_information_json
      ? JSON.parse(String(row.missing_information_json))
      : undefined,
    calculationMethod: String(row.calculation_method),
    targetYieldNote: row.target_yield_note ? String(row.target_yield_note) : undefined,
    targetsKgPerHa: JSON.parse(String(row.targets_json)),
    soilAdjustmentNotes: JSON.parse(String(row.soil_adjustment_notes_json)),
    lineItems,
    totalEstimatedCostInr: Number(row.estimated_cost),
    applicationSchedule: JSON.parse(String(row.application_schedule_json)),
    assumptions: JSON.parse(String(row.assumptions_json)),
    warnings: JSON.parse(String(row.warnings_json)),
    sourceReferences: JSON.parse(String(row.source_references_json)),
    createdAt: String(row.created_at),
  };
}

async function ensureDemoSeededSoilAndFertilizer(): Promise<void> {
  const db = await getDatabase();
  const demoUserId = 'usr_demo_karnataka';
  const existing = queryOne<{ id: string }>(
    db,
    `SELECT id FROM soil_analyses WHERE user_id = ? LIMIT 1`,
    [demoUserId],
  );
  if (existing) return;

  const now = new Date().toISOString();
  const sampleDate = now.slice(0, 10);
  const sampleId = 'smp_demo_mandya_01';
  const analysisId = 'anl_demo_mandya_01';

  const demoMeasurements: SoilMeasurementInput[] = [
    { parameterName: 'pH', measuredValue: 6.9, unit: 'pH', method: '1:2.5 soil-water' },
    { parameterName: 'EC', measuredValue: 0.44, unit: 'dS/m', method: 'Conductivity bridge' },
    { parameterName: 'OrganicCarbon', measuredValue: 0.46, unit: '%', method: 'Walkley-Black' },
    { parameterName: 'Nitrogen', measuredValue: 224, unit: 'kg/ha', method: 'Alkaline KMnO4' },
    { parameterName: 'Phosphorus', measuredValue: 16.5, unit: 'kg/ha', method: 'Olsen P' },
    { parameterName: 'Potassium', measuredValue: 252, unit: 'kg/ha', method: 'Neutral Normal NH4OAc' },
    { parameterName: 'Sulphur', measuredValue: 11.4, unit: 'ppm', method: '0.15% CaCl2' },
    { parameterName: 'Zinc', measuredValue: 0.48, unit: 'ppm', method: 'DTPA Extract' },
    { parameterName: 'Iron', measuredValue: 10.6, unit: 'ppm', method: 'DTPA Extract' },
    { parameterName: 'Boron', measuredValue: 0.56, unit: 'ppm', method: 'Hot-Water Soluble' },
    { parameterName: 'Copper', measuredValue: 1.12, unit: 'ppm', method: 'DTPA Extract' },
    { parameterName: 'Manganese', measuredValue: 8.2, unit: 'ppm', method: 'DTPA Extract' },
    { parameterName: 'Moisture', measuredValue: 24, unit: '%', method: 'Gravimetric' },
  ];

  const evalRes = evaluateSoilAnalysis('Mandya', demoMeasurements, 'Karnataka');
  const fingerprint = createSampleFingerprint('farm_mandya_01', sampleDate, demoMeasurements);

  runStatement(
    db,
    `INSERT INTO soil_samples (id, farm_id, user_id, sample_date, sample_depth, lab_name, extraction_method, uploaded_report_name, verification_status, fingerprint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sampleId,
      'farm_mandya_01',
      demoUserId,
      sampleDate,
      '0–15 cm',
      'Mandya District Soil Health Laboratory (SHC)',
      'Standard ICAR-SHC Wet Chemistry',
      'Mandya_SHC_Demo_Report.pdf',
      'verified',
      fingerprint,
      now,
    ],
  );

  for (const m of demoMeasurements) {
    runStatement(
      db,
      `INSERT INTO soil_measurements (id, soil_sample_id, parameter_name, measured_value, unit, method)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [makeId('msm'), sampleId, m.parameterName, m.measuredValue, m.unit, m.method ?? 'Lab reported'],
    );
  }

  runStatement(
    db,
    `INSERT INTO soil_analyses (id, soil_sample_id, farm_id, user_id, crop, nutrient_status_json, missing_parameters_json, analysis_summary, deficiencies_count, excess_count, sufficient_count, source_references_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      analysisId,
      sampleId,
      'farm_mandya_01',
      demoUserId,
      'Rice',
      JSON.stringify(evalRes.assessments),
      JSON.stringify(evalRes.missingParameters),
      evalRes.overallHealthSummary,
      evalRes.deficienciesCount,
      evalRes.excessCount,
      evalRes.sufficientCount,
      JSON.stringify(evalRes.sourceReferences),
      now,
    ],
  );

  // Seed deterministic fertilizer plan for the demo Mandya Rice plot
  const recData = calculateFertilizerRecommendation({
    soilAnalysisId: analysisId,
    farmId: 'farm_mandya_01',
    farmName: 'Cauvery Canal Plot — Maddur',
    state: 'Karnataka',
    district: 'Mandya',
    crop: 'Rice',
    season: 'Kharif',
    growthStage: 'Pre-sowing / Basal',
    landAreaHectares: Number((3.5 * 0.404686).toFixed(4)),
    landAreaDisplay: '3.5 acre',
    assessments: evalRes.assessments,
    preferredPSource: 'auto',
    includeZincIfDeficient: true,
  });

  const recId = 'rec_demo_mandya_01';
  runStatement(
    db,
    `INSERT INTO fertilizer_recommendations
     (id, user_id, farm_id, soil_analysis_id, crop_nutrient_standard_id, crop, season, growth_stage, land_area_hectares, land_area_display, status, expert_review_reason, missing_information_json, calculation_method, target_yield_note, targets_json, soil_adjustment_notes_json, assumptions_json, warnings_json, application_schedule_json, estimated_cost, source_references_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recId,
      demoUserId,
      recData.farmId,
      recData.soilAnalysisId,
      'std_rice_mandya_kharif',
      recData.crop,
      recData.season,
      recData.growthStage,
      recData.landAreaHectares,
      recData.landAreaDisplay,
      recData.status,
      recData.expertReviewReason ?? null,
      recData.missingInformation ? JSON.stringify(recData.missingInformation) : null,
      recData.calculationMethod,
      recData.targetYieldNote ?? null,
      JSON.stringify(recData.targetsKgPerHa),
      JSON.stringify(recData.soilAdjustmentNotes),
      JSON.stringify(recData.assumptions),
      JSON.stringify(recData.warnings),
      JSON.stringify(recData.applicationSchedule),
      recData.totalEstimatedCostInr,
      JSON.stringify(recData.sourceReferences),
      now,
    ],
  );

  for (const item of recData.lineItems) {
    runStatement(
      db,
      `INSERT INTO fertilizer_line_items
       (id, recommendation_id, fertilizer_product_id, product_name, grade_label, quantity_per_hectare, total_quantity, bag_weight_kg, total_bags, price_per_bag_inr, estimated_price, nutrients_contributed_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        makeId('fli'),
        recId,
        item.fertilizerProductId,
        item.productName,
        item.gradeLabel,
        item.quantityPerHectareKg,
        item.totalQuantityKg,
        item.bagWeightKg,
        item.totalBags,
        item.pricePerBagInr,
        item.estimatedPriceInr,
        JSON.stringify(item.nutrientsContributedKgPerHa),
      ],
    );
  }
}

export function createExpressApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const v1 = express.Router();

  // Health & Deployment metadata
  v1.get('/health', async (_req, res: Response) => {
    await getDatabase();
    res.json({
      status: 'ok',
      service: 'SoilSense AI Express API',
      runtime: process.env.VERCEL === '1' ? 'vercel-serverless' : 'node-express',
      persistence: getPersistenceMode(),
      aiProviders: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
        nvidiaFallbackConfigured: Boolean(process.env.NVIDIA_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // --- MODULE 1: USER AUTHENTICATION & PROFILE ---
  v1.post('/auth/register', async (req, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details' });
      return;
    }

    const db = await getDatabase();
    const emailLower = parsed.data.email.toLowerCase();
    const exists = queryOne<{ id: string }>(db, `SELECT id FROM users WHERE email = ?`, [emailLower]);
    if (exists) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const userId = makeId('usr');
    const now = new Date().toISOString();
    runStatement(
      db,
      `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, parsed.data.name, emailLower, hashPassword(parsed.data.password), 'farmer', now],
    );
    runStatement(
      db,
      `INSERT INTO farmer_profiles (user_id, phone, preferred_language) VALUES (?, ?, ?)`,
      [userId, parsed.data.phone ?? '', parsed.data.preferredLanguage],
    );

    const payload = { userId, email: emailLower, name: parsed.data.name, role: 'farmer' };
    const profile = await getUserProfileById(userId);
    res.status(201).json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: profile,
    });
  });

  v1.post('/auth/login', async (req, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const db = await getDatabase();
    const userRow = queryOne<Record<string, unknown>>(
      db,
      `SELECT id, name, email, password_hash, role FROM users WHERE email = ?`,
      [parsed.data.email.toLowerCase()],
    );

    if (!userRow || !verifyPassword(parsed.data.password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (String(userRow.email) === 'demo@soilsense.in') {
      await ensureDemoSeededSoilAndFertilizer();
    }

    const payload = {
      userId: String(userRow.id),
      email: String(userRow.email),
      name: String(userRow.name),
      role: String(userRow.role),
    };
    const profile = await getUserProfileById(payload.userId);
    res.json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: profile,
    });
  });

  v1.post('/auth/demo', async (_req, res: Response) => {
    await getDatabase();
    await ensureDemoSeededSoilAndFertilizer();
    const profile = await getUserProfileById('usr_demo_karnataka');
    if (!profile) {
      res.status(500).json({ error: 'Demo farmer profile could not be initialized.' });
      return;
    }
    const payload = {
      userId: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    };
    res.json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: profile,
    });
  });

  v1.post('/auth/refresh', async (req, res: Response) => {
    const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    if (!token) {
      res.status(400).json({ error: 'refreshToken is required.' });
      return;
    }
    try {
      const payload = verifyRefreshToken(token);
      const clean = {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      res.json({
        accessToken: signAccessToken(clean),
        refreshToken: signRefreshToken(clean),
      });
    } catch {
      res.status(401).json({ error: 'Refresh token invalid or expired.' });
    }
  });

  v1.get('/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const profile = await getUserProfileById(req.authUser!.userId);
    if (!profile) {
      res.status(404).json({ error: 'Farmer profile not found.' });
      return;
    }
    res.json({ user: profile });
  });

  v1.put('/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().optional(),
      preferredLanguage: z.enum(['en', 'kn', 'ta', 'te', 'hi']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid profile fields.' });
      return;
    }

    const db = await getDatabase();
    const uid = req.authUser!.userId;
    if (parsed.data.name) {
      runStatement(db, `UPDATE users SET name = ? WHERE id = ?`, [parsed.data.name, uid]);
    }
    if (parsed.data.phone !== undefined || parsed.data.preferredLanguage !== undefined) {
      const existing = queryOne<{ phone: string; preferred_language: string }>(
        db,
        `SELECT phone, preferred_language FROM farmer_profiles WHERE user_id = ?`,
        [uid],
      );
      const nextPhone = parsed.data.phone ?? existing?.phone ?? '';
      const nextLang = parsed.data.preferredLanguage ?? existing?.preferred_language ?? 'en';
      runStatement(
        db,
        `INSERT OR REPLACE INTO farmer_profiles (user_id, phone, preferred_language) VALUES (?, ?, ?)`,
        [uid, nextPhone, nextLang],
      );
    }

    const updated = await getUserProfileById(uid);
    res.json({ user: updated });
  });

  // --- MODULE 2: FARM MANAGEMENT ---
  v1.get('/farms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const rows = queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM farms WHERE user_id = ? ORDER BY created_at DESC`,
      [req.authUser!.userId],
    );
    res.json({ farms: rows.map(mapFarmRow) });
  });

  v1.post('/farms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = farmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid farm input' });
      return;
    }

    const db = await getDatabase();
    const id = makeId('farm');
    const now = new Date().toISOString();
    const districtProfile =
      INDIA_DISTRICTS.find((d) => d.district.toLowerCase() === parsed.data.district.toLowerCase()) ??
      INDIA_DISTRICTS.find((d) => d.state.toLowerCase() === parsed.data.state.toLowerCase());
    const lat = parsed.data.latitude ?? districtProfile?.latitude ?? null;
    const lon = parsed.data.longitude ?? districtProfile?.longitude ?? null;
    const areaHa = convertAreaToHectares(parsed.data.landArea, parsed.data.areaUnit);
    const soilType = parsed.data.soilType || districtProfile?.dominantSoilType || 'Loamy Agricultural Soil';

    runStatement(
      db,
      `INSERT INTO farms (id, user_id, farm_name, state, district, village, latitude, longitude, land_area, area_unit, area_hectares, selected_crop, crop_season, growth_stage, soil_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.authUser!.userId,
        parsed.data.farmName,
        parsed.data.state,
        parsed.data.district,
        parsed.data.village,
        lat,
        lon,
        parsed.data.landArea,
        parsed.data.areaUnit,
        areaHa,
        parsed.data.selectedCrop,
        parsed.data.cropSeason,
        parsed.data.growthStage,
        soilType,
        now,
      ],
    );

    const row = queryOne<Record<string, unknown>>(db, `SELECT * FROM farms WHERE id = ?`, [id]);
    res.status(201).json({ farm: mapFarmRow(row!) });
  });

  v1.get('/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM farms WHERE id = ? AND user_id = ?`,
      [req.params.id, req.authUser!.userId],
    );
    if (!row) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    res.json({ farm: mapFarmRow(row) });
  });

  v1.put('/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = farmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid farm update' });
      return;
    }
    const db = await getDatabase();
    const existing = queryOne<{ id: string }>(
      db,
      `SELECT id FROM farms WHERE id = ? AND user_id = ?`,
      [req.params.id, req.authUser!.userId],
    );
    if (!existing) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    const areaHa = convertAreaToHectares(parsed.data.landArea, parsed.data.areaUnit);
    runStatement(
      db,
      `UPDATE farms
       SET farm_name = ?, state = ?, district = ?, village = ?, latitude = ?, longitude = ?,
           land_area = ?, area_unit = ?, area_hectares = ?, selected_crop = ?, crop_season = ?, growth_stage = ?, soil_type = ?
       WHERE id = ? AND user_id = ?`,
      [
        parsed.data.farmName,
        parsed.data.state,
        parsed.data.district,
        parsed.data.village,
        parsed.data.latitude ?? null,
        parsed.data.longitude ?? null,
        parsed.data.landArea,
        parsed.data.areaUnit,
        areaHa,
        parsed.data.selectedCrop,
        parsed.data.cropSeason,
        parsed.data.growthStage,
        parsed.data.soilType ?? '',
        req.params.id,
        req.authUser!.userId,
      ],
    );
    const updated = queryOne<Record<string, unknown>>(db, `SELECT * FROM farms WHERE id = ?`, [req.params.id]);
    res.json({ farm: mapFarmRow(updated!) });
  });

  v1.delete('/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const existing = queryOne<{ id: string }>(
      db,
      `SELECT id FROM farms WHERE id = ? AND user_id = ?`,
      [req.params.id, req.authUser!.userId],
    );
    if (!existing) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    runStatement(db, `DELETE FROM farms WHERE id = ? AND user_id = ?`, [req.params.id, req.authUser!.userId]);
    res.json({ deleted: true, id: req.params.id });
  });

  // --- MODULE 5: CROPS & EXPLORATORY CROP SUITABILITY ---
  v1.get('/crops', (_req, res: Response) => {
    res.json({
      crops: SUPPORTED_CROPS,
      states: INDIAN_STATES,
      districts: INDIA_DISTRICTS,
      fertilizerProducts: FERTILIZER_PRODUCTS,
    });
  });

  v1.post('/crops/recommend', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      nitrogenKgHa: z.number().min(0).max(1500),
      phosphorusKgHa: z.number().min(0).max(300),
      potassiumKgHa: z.number().min(0).max(2000),
      ph: z.number().min(3).max(10.5),
      temperatureC: z.number().min(5).max(50),
      humidityPct: z.number().min(5).max(100),
      rainfallMm: z.number().min(0).max(600),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide valid NPK, pH, temperature, humidity, and rainfall values.' });
      return;
    }
    const recommendations = evaluateCropSuitability(parsed.data);
    res.json({ recommendations });
  });

  // --- MODULE 3 & 4: SOIL REPORT UPLOAD, EXTRACTION & ANALYSIS ---
  v1.post('/soil/upload', requireAuth, upload.single('report'), async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Please upload a PDF or image soil report file (max 8 MB).' });
      return;
    }
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Supported file formats are PDF, JPG, PNG, and WebP.' });
      return;
    }

    try {
      const extracted = await extractSoilReportWithGemini(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({
        uploadedFileName: req.file.originalname,
        extracted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract values from uploaded report.';
      res.status(502).json({ error: message });
    }
  });

  v1.post('/soil/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const bodySchema = z.object({
      farmId: z.string().min(1, 'Select a farm first'),
      crop: z.string().min(1).optional(),
      sampleDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
      sampleDepth: z.string().default('0–15 cm'),
      labName: z.string().default('Manual Farmer Entry / SHC'),
      extractionMethod: z.string().default('Standard ICAR Soil Health Card'),
      uploadedReportName: z.string().optional(),
      allowDuplicate: z.boolean().optional(),
      measurements: z.array(
        z.object({
          parameterName: z.enum([
            'pH', 'Nitrogen', 'Phosphorus', 'Potassium', 'EC', 'OrganicCarbon',
            'Sulphur', 'Zinc', 'Iron', 'Boron', 'Copper', 'Manganese', 'Moisture',
          ]),
          measuredValue: z.number().nullable(),
          unit: z.string().min(1),
          method: z.string().optional(),
        }),
      ),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid soil analysis payload.' });
      return;
    }

    const validation = validateSoilMeasurements(parsed.data.measurements);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0], validationErrors: validation.errors });
      return;
    }

    const db = await getDatabase();
    const farmRow = queryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM farms WHERE id = ? AND user_id = ?`,
      [parsed.data.farmId, req.authUser!.userId],
    );
    if (!farmRow) {
      res.status(404).json({ error: 'Selected farm was not found.' });
      return;
    }

    const farm = mapFarmRow(farmRow);
    const fingerprint = createSampleFingerprint(
      farm.id,
      parsed.data.sampleDate,
      parsed.data.measurements,
    );

    if (!parsed.data.allowDuplicate) {
      const dup = queryOne<{ id: string }>(
        db,
        `SELECT id FROM soil_samples WHERE farm_id = ? AND user_id = ? AND fingerprint = ?`,
        [farm.id, req.authUser!.userId, fingerprint],
      );
      if (dup) {
        res.status(409).json({
          error:
            'A soil sample with these exact values and date has already been saved for this farm. Update the sample date or values if this is a new test.',
        });
        return;
      }
    }

    const evalRes = evaluateSoilAnalysis(farm.district, parsed.data.measurements, farm.state);
    const now = new Date().toISOString();
    const sampleId = makeId('smp');
    const analysisId = makeId('anl');
    const targetCrop = parsed.data.crop || farm.selectedCrop;

    runStatement(
      db,
      `INSERT INTO soil_samples (id, farm_id, user_id, sample_date, sample_depth, lab_name, extraction_method, uploaded_report_name, verification_status, fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sampleId,
        farm.id,
        req.authUser!.userId,
        parsed.data.sampleDate,
        parsed.data.sampleDepth,
        parsed.data.labName,
        parsed.data.extractionMethod,
        parsed.data.uploadedReportName ?? null,
        'verified',
        fingerprint,
        now,
      ],
    );

    for (const m of parsed.data.measurements) {
      if (m.measuredValue === null || m.measuredValue === undefined) continue;
      runStatement(
        db,
        `INSERT INTO soil_measurements (id, soil_sample_id, parameter_name, measured_value, unit, method)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [makeId('msm'), sampleId, m.parameterName, m.measuredValue, m.unit, m.method ?? 'Lab reported'],
      );
    }

    runStatement(
      db,
      `INSERT INTO soil_analyses (id, soil_sample_id, farm_id, user_id, crop, nutrient_status_json, missing_parameters_json, analysis_summary, deficiencies_count, excess_count, sufficient_count, source_references_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        analysisId,
        sampleId,
        farm.id,
        req.authUser!.userId,
        targetCrop,
        JSON.stringify(evalRes.assessments),
        JSON.stringify(evalRes.missingParameters),
        evalRes.overallHealthSummary,
        evalRes.deficienciesCount,
        evalRes.excessCount,
        evalRes.sufficientCount,
        JSON.stringify(evalRes.sourceReferences),
        now,
      ],
    );

    const record = await fetchAnalysisRecord(analysisId, req.authUser!.userId);
    res.status(201).json({ analysis: record });
  });

  v1.get('/soil/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const farmFilter = typeof req.query.farmId === 'string' ? req.query.farmId : null;
    const rows = queryAll<{ id: string }>(
      db,
      farmFilter
        ? `SELECT id FROM soil_analyses WHERE user_id = ? AND farm_id = ? ORDER BY created_at DESC`
        : `SELECT id FROM soil_analyses WHERE user_id = ? ORDER BY created_at DESC`,
      farmFilter ? [req.authUser!.userId, farmFilter] : [req.authUser!.userId],
    );
    const analyses: SoilAnalysisRecord[] = [];
    for (const r of rows) {
      const full = await fetchAnalysisRecord(r.id, req.authUser!.userId);
      if (full) analyses.push(full);
    }
    res.json({ analyses });
  });

  v1.get('/soil/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const record = await fetchAnalysisRecord(req.params.id, req.authUser!.userId);
    if (!record) {
      res.status(404).json({ error: 'Soil analysis not found.' });
      return;
    }
    res.json({ analysis: record });
  });

  // --- MODULE 6: DETERMINISTIC FERTILIZER ENGINE ---
  v1.post('/fertilizer/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      soilAnalysisId: z.string().min(1),
      crop: z.string().min(1).optional(),
      season: z.enum(['Kharif', 'Rabi', 'Summer', 'Annual']).optional(),
      growthStage: z
        .enum([
          'Pre-sowing / Basal',
          'Vegetative / Tillering',
          'Flowering / Panicle',
          'Grain Filling / Maturity',
        ])
        .optional(),
      preferredPSource: z.enum(['auto', 'DAP', 'SSP']).default('auto'),
      includeZincIfDeficient: z.boolean().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid soilAnalysisId is required.' });
      return;
    }

    const analysis = await fetchAnalysisRecord(parsed.data.soilAnalysisId, req.authUser!.userId);
    if (!analysis) {
      res.status(404).json({ error: 'Soil analysis not found for this user.' });
      return;
    }

    const db = await getDatabase();
    const farmRow = queryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM farms WHERE id = ? AND user_id = ?`,
      [analysis.farmId, req.authUser!.userId],
    );
    if (!farmRow) {
      res.status(404).json({ error: 'Associated farm not found.' });
      return;
    }
    const farm = mapFarmRow(farmRow);

    const crop = parsed.data.crop || analysis.crop || farm.selectedCrop;
    const season = parsed.data.season || farm.cropSeason;
    const growthStage = parsed.data.growthStage || farm.growthStage;

    const calculated = calculateFertilizerRecommendation({
      soilAnalysisId: analysis.id,
      farmId: farm.id,
      farmName: farm.farmName,
      state: farm.state,
      district: farm.district,
      crop,
      season,
      growthStage,
      landAreaHectares: farm.areaHectares,
      landAreaDisplay: `${farm.landArea} ${farm.areaUnit}`,
      assessments: analysis.assessments,
      preferredPSource: parsed.data.preferredPSource,
      includeZincIfDeficient: parsed.data.includeZincIfDeficient,
    });

    const recId = makeId('rec');
    const now = new Date().toISOString();

    runStatement(
      db,
      `INSERT INTO fertilizer_recommendations
       (id, user_id, farm_id, soil_analysis_id, crop_nutrient_standard_id, crop, season, growth_stage, land_area_hectares, land_area_display, status, expert_review_reason, missing_information_json, calculation_method, target_yield_note, targets_json, soil_adjustment_notes_json, assumptions_json, warnings_json, application_schedule_json, estimated_cost, source_references_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recId,
        req.authUser!.userId,
        calculated.farmId,
        calculated.soilAnalysisId,
        null,
        calculated.crop,
        calculated.season,
        calculated.growthStage,
        calculated.landAreaHectares,
        calculated.landAreaDisplay,
        calculated.status,
        calculated.expertReviewReason ?? null,
        calculated.missingInformation ? JSON.stringify(calculated.missingInformation) : null,
        calculated.calculationMethod,
        calculated.targetYieldNote ?? null,
        JSON.stringify(calculated.targetsKgPerHa),
        JSON.stringify(calculated.soilAdjustmentNotes),
        JSON.stringify(calculated.assumptions),
        JSON.stringify(calculated.warnings),
        JSON.stringify(calculated.applicationSchedule),
        calculated.totalEstimatedCostInr,
        JSON.stringify(calculated.sourceReferences),
        now,
      ],
    );

    for (const item of calculated.lineItems) {
      runStatement(
        db,
        `INSERT INTO fertilizer_line_items
         (id, recommendation_id, fertilizer_product_id, product_name, grade_label, quantity_per_hectare, total_quantity, bag_weight_kg, total_bags, price_per_bag_inr, estimated_price, nutrients_contributed_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          makeId('fli'),
          recId,
          item.fertilizerProductId,
          item.productName,
          item.gradeLabel,
          item.quantityPerHectareKg,
          item.totalQuantityKg,
          item.bagWeightKg,
          item.totalBags,
          item.pricePerBagInr,
          item.estimatedPriceInr,
          JSON.stringify(item.nutrientsContributedKgPerHa),
        ],
      );
    }

    const saved = await fetchRecommendationRecord(recId, req.authUser!.userId);
    res.status(201).json({ recommendation: saved });
  });

  v1.get('/fertilizer', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const rows = queryAll<{ id: string }>(
      db,
      `SELECT id FROM fertilizer_recommendations WHERE user_id = ? ORDER BY created_at DESC`,
      [req.authUser!.userId],
    );
    const recommendations: FertilizerRecommendationRecord[] = [];
    for (const r of rows) {
      const full = await fetchRecommendationRecord(r.id, req.authUser!.userId);
      if (full) recommendations.push(full);
    }
    res.json({ recommendations });
  });

  v1.get('/fertilizer/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const rec = await fetchRecommendationRecord(req.params.id, req.authUser!.userId);
    if (!rec) {
      res.status(404).json({ error: 'Fertilizer recommendation not found.' });
      return;
    }
    res.json({ recommendation: rec });
  });

  // --- MODULE 7: MULTILINGUAL RAG AI ASSISTANT ---
  v1.get('/assistant/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const sessionRows = queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`,
      [req.authUser!.userId],
    );
    const sessions: ChatSessionRecord[] = sessionRows.map((s) => {
      const msgRows = queryAll<Record<string, unknown>>(
        db,
        `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
        [String(s.id)],
      );
      const messages: ChatMessageRecord[] = msgRows.map((m) => ({
        id: String(m.id),
        sessionId: String(m.session_id),
        question: String(m.question),
        answer: String(m.answer),
        language: m.language as SupportedLanguage,
        provider: m.provider as 'gemini' | 'nvidia' | 'error',
        sourceReferences: JSON.parse(String(m.source_references_json)),
        createdAt: String(m.created_at),
      }));
      return {
        id: String(s.id),
        userId: String(s.user_id),
        farmId: s.farm_id ? String(s.farm_id) : null,
        title: String(s.title),
        createdAt: String(s.created_at),
        messages,
      };
    });
    res.json({ sessions });
  });

  v1.post('/assistant/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      question: z.string().trim().min(2, 'Please enter a question for the SoilSense AI Assistant.'),
      language: z.enum(['en', 'kn', 'ta', 'te', 'hi']).default('en'),
      sessionId: z.string().optional(),
      farmId: z.string().optional(),
      soilAnalysisId: z.string().optional(),
      recommendationId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid chat request.' });
      return;
    }

    const db = await getDatabase();
    const uid = req.authUser!.userId;

    // Resolve active farm, soil analysis & recommendation context
    let farmContext: {
      farmName: string;
      state: string;
      district: string;
      village: string;
      crop: string;
      season: string;
      areaDisplay: string;
    } | null = null;

    if (parsed.data.farmId) {
      const fRow = queryOne<Record<string, unknown>>(
        db,
        `SELECT * FROM farms WHERE id = ? AND user_id = ?`,
        [parsed.data.farmId, uid],
      );
      if (fRow) {
        const f = mapFarmRow(fRow);
        farmContext = {
          farmName: f.farmName,
          state: f.state,
          district: f.district,
          village: f.village,
          crop: f.selectedCrop,
          season: f.cropSeason,
          areaDisplay: `${f.landArea} ${f.areaUnit} (${f.areaHectares} ha)`,
        };
      }
    }

    let analysis: SoilAnalysisRecord | null = null;
    if (parsed.data.soilAnalysisId) {
      analysis = await fetchAnalysisRecord(parsed.data.soilAnalysisId, uid);
    } else if (parsed.data.farmId) {
      const latestRow = queryOne<{ id: string }>(
        db,
        `SELECT id FROM soil_analyses WHERE farm_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [parsed.data.farmId, uid],
      );
      if (latestRow) analysis = await fetchAnalysisRecord(latestRow.id, uid);
    }

    let recommendation: FertilizerRecommendationRecord | null = null;
    if (parsed.data.recommendationId) {
      recommendation = await fetchRecommendationRecord(parsed.data.recommendationId, uid);
    } else if (parsed.data.farmId) {
      const latestRec = queryOne<{ id: string }>(
        db,
        `SELECT id FROM fertilizer_recommendations WHERE farm_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [parsed.data.farmId, uid],
      );
      if (latestRec) recommendation = await fetchRecommendationRecord(latestRec.id, uid);
    }

    // Resolve or create session
    let sessionId = parsed.data.sessionId;
    if (sessionId) {
      const owned = queryOne<{ id: string }>(
        db,
        `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?`,
        [sessionId, uid],
      );
      if (!owned) sessionId = undefined;
    }

    const now = new Date().toISOString();
    if (!sessionId) {
      sessionId = makeId('chs');
      const title = parsed.data.question.slice(0, 56);
      runStatement(
        db,
        `INSERT INTO chat_sessions (id, user_id, farm_id, title, created_at) VALUES (?, ?, ?, ?, ?)`,
        [sessionId, uid, parsed.data.farmId ?? null, title, now],
      );
    }

    const previousMsgs = queryAll<{ question: string; answer: string }>(
      db,
      `SELECT question, answer FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId],
    );

    try {
      const reply = await generateGroundedAgronomicAnswer({
        question: parsed.data.question,
        language: parsed.data.language,
        farmContext,
        latestAnalysis: analysis,
        latestRecommendation: recommendation,
        history: previousMsgs,
      });

      const msgId = makeId('chm');
      const msgTime = new Date().toISOString();
      runStatement(
        db,
        `INSERT INTO chat_messages (id, session_id, question, answer, language, provider, source_references_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          sessionId,
          parsed.data.question,
          reply.answer,
          parsed.data.language,
          reply.provider,
          JSON.stringify(reply.sourceReferences),
          msgTime,
        ],
      );

      res.json({
        sessionId,
        message: {
          id: msgId,
          sessionId,
          question: parsed.data.question,
          answer: reply.answer,
          language: parsed.data.language,
          provider: reply.provider,
          sourceReferences: reply.sourceReferences,
          createdAt: msgTime,
        } satisfies ChatMessageRecord,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI assistant error.';
      res.status(502).json({ error: message });
    }
  });

  // --- MODULE 8: PDF REPORT GENERATION & DOWNLOAD ---
  v1.post('/reports/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      soilAnalysisId: z.string().min(1),
      recommendationId: z.string().nullable().optional(),
      reportTitle: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'soilAnalysisId is required to generate a report.' });
      return;
    }

    const uid = req.authUser!.userId;
    const analysis = await fetchAnalysisRecord(parsed.data.soilAnalysisId, uid);
    if (!analysis) {
      res.status(404).json({ error: 'Soil analysis not found.' });
      return;
    }

    const db = await getDatabase();
    let recId = parsed.data.recommendationId ?? null;
    if (!recId) {
      const latestRec = queryOne<{ id: string }>(
        db,
        `SELECT id FROM fertilizer_recommendations WHERE soil_analysis_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [analysis.id, uid],
      );
      recId = latestRec?.id ?? null;
    }

    const id = makeId('rpt');
    const now = new Date().toISOString();
    const title =
      parsed.data.reportTitle ||
      `${analysis.farmName} — ${analysis.crop} Soil & Fertilizer Advisory (${analysis.sampleDate})`;

    runStatement(
      db,
      `INSERT INTO reports (id, user_id, farm_id, soil_analysis_id, recommendation_id, report_title, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, uid, analysis.farmId, analysis.id, recId, title, now],
    );

    const record: ReportRecord = {
      id,
      userId: uid,
      farmId: analysis.farmId,
      farmName: analysis.farmName,
      crop: analysis.crop,
      soilAnalysisId: analysis.id,
      recommendationId: recId,
      reportTitle: title,
      createdAt: now,
    };

    res.status(201).json({ report: record });
  });

  v1.get('/reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const rows = queryAll<Record<string, unknown>>(
      db,
      `SELECT r.*, f.farm_name, a.crop
       FROM reports r
       JOIN farms f ON f.id = r.farm_id
       JOIN soil_analyses a ON a.id = r.soil_analysis_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.authUser!.userId],
    );
    const reports: ReportRecord[] = rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      farmId: String(r.farm_id),
      farmName: String(r.farm_name),
      crop: String(r.crop),
      soilAnalysisId: String(r.soil_analysis_id),
      recommendationId: r.recommendation_id ? String(r.recommendation_id) : null,
      reportTitle: String(r.report_title),
      createdAt: String(r.created_at),
    }));
    res.json({ reports });
  });

  v1.get('/reports/:id/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDatabase();
    const uid = req.authUser!.userId;
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM reports WHERE id = ? AND user_id = ?`,
      [req.params.id, uid],
    );
    if (!row) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const farmer = await getUserProfileById(uid);
    const farmRow = queryOne<Record<string, unknown>>(db, `SELECT * FROM farms WHERE id = ?`, [String(row.farm_id)]);
    const analysis = await fetchAnalysisRecord(String(row.soil_analysis_id), uid);
    const recommendation = row.recommendation_id
      ? await fetchRecommendationRecord(String(row.recommendation_id), uid)
      : null;

    if (!farmer || !farmRow || !analysis) {
      res.status(404).json({ error: 'Underlying report records could not be loaded.' });
      return;
    }

    const pdfBuffer = await buildAdvisoryPdfBuffer({
      farmer,
      farm: mapFarmRow(farmRow),
      analysis,
      recommendation,
      reportTitle: String(row.report_title),
    });

    const safeFileName = `SoilSense_${analysis.district}_${analysis.crop}_${analysis.sampleDate}.pdf`.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.send(pdfBuffer);
  });

  // --- MODULE 9: NON-BLOCKING WEATHER ADVISORY ---
  v1.get('/weather', async (req, res: Response) => {
    const district = typeof req.query.district === 'string' && req.query.district ? req.query.district : 'Ludhiana';
    const state = typeof req.query.state === 'string' && req.query.state ? req.query.state : undefined;
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lon = req.query.lon ? Number(req.query.lon) : null;
    const advisory = await getWeatherAdvisoryForDistrict(district, lat, lon, state);
    res.json({ weather: advisory });
  });

  // --- DATASET FOUNDATION & ALL-INDIA SOIL ANALYTICS ---
  const handleDatasetSummary = (_req: express.Request, res: Response) => {
    let qualitySummary = null;
    try {
      qualitySummary = runKarnatakaDatasetValidation(undefined, false);
    } catch {
      qualitySummary = null;
    }
    res.json({
      registry: DATASET_REGISTRY,
      states: INDIAN_STATES,
      districts: INDIA_DISTRICTS,
      qualitySummary,
    });
  };

  v1.get('/datasets/india-summary', handleDatasetSummary);
  v1.get('/datasets/karnataka-summary', handleDatasetSummary);

  app.use('/api/v1', v1);

  return app;
}
