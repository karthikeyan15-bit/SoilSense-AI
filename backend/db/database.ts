import initSqlJs, { type Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  CROP_NUTRIENT_STANDARDS,
  FERTILIZER_PRODUCTS,
  SUPPORTED_CROPS,
} from '../data/agronomicData.js';

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

function resolveDbPath(): string {
  // Vercel serverless filesystem is read-only outside /tmp
  if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'soilsense.sqlite');
  }
  const dir = path.resolve(process.cwd(), 'data', 'processed');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'soilsense.sqlite');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (hashBuffer.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, keyBuffer);
}

export function persistDb(): void {
  if (!dbInstance) return;
  try {
    const dbPath = resolveDbPath();
    const data = dbInstance.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.warn('SQLite persistence warning:', err instanceof Error ? err.message : err);
  }
}

export function queryAll<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

export function runStatement(db: Database, sql: string, params: unknown[] = []): void {
  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  stmt.step();
  stmt.free();
  persistDb();
}

function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'farmer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farmer_profiles (
      user_id TEXT PRIMARY KEY,
      phone TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farm_name TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      village TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      land_area REAL NOT NULL,
      area_unit TEXT NOT NULL,
      area_hectares REAL NOT NULL,
      selected_crop TEXT NOT NULL,
      crop_season TEXT NOT NULL,
      growth_stage TEXT NOT NULL,
      soil_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crops (
      id TEXT PRIMARY KEY,
      crop_name TEXT UNIQUE NOT NULL,
      seasons_json TEXT NOT NULL,
      icar_supported INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS soil_samples (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sample_date TEXT NOT NULL,
      sample_depth TEXT NOT NULL,
      lab_name TEXT NOT NULL,
      extraction_method TEXT NOT NULL,
      uploaded_report_name TEXT,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS soil_measurements (
      id TEXT PRIMARY KEY,
      soil_sample_id TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      measured_value REAL,
      unit TEXT NOT NULL,
      method TEXT,
      FOREIGN KEY (soil_sample_id) REFERENCES soil_samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS soil_analyses (
      id TEXT PRIMARY KEY,
      soil_sample_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      crop TEXT NOT NULL,
      nutrient_status_json TEXT NOT NULL,
      missing_parameters_json TEXT NOT NULL,
      analysis_summary TEXT NOT NULL,
      deficiencies_count INTEGER NOT NULL DEFAULT 0,
      excess_count INTEGER NOT NULL DEFAULT 0,
      sufficient_count INTEGER NOT NULL DEFAULT 0,
      source_references_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (soil_sample_id) REFERENCES soil_samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crop_nutrient_standards (
      id TEXT PRIMARY KEY,
      crop TEXT NOT NULL,
      district TEXT NOT NULL,
      season TEXT NOT NULL,
      soil_type TEXT NOT NULL,
      target_yield TEXT NOT NULL,
      nitrogen_requirement REAL NOT NULL,
      phosphorus_requirement REAL NOT NULL,
      potassium_requirement REAL NOT NULL,
      source_reference TEXT NOT NULL,
      effective_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fertilizer_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      nitrogen_percentage REAL NOT NULL,
      phosphorus_percentage REAL NOT NULL,
      potassium_percentage REAL NOT NULL,
      other_nutrients TEXT NOT NULL,
      bag_weight_kg REAL NOT NULL,
      price_per_bag_inr REAL NOT NULL,
      product_source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fertilizer_recommendations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      soil_analysis_id TEXT NOT NULL,
      crop_nutrient_standard_id TEXT,
      crop TEXT NOT NULL,
      season TEXT NOT NULL,
      growth_stage TEXT NOT NULL,
      land_area_hectares REAL NOT NULL,
      land_area_display TEXT NOT NULL,
      status TEXT NOT NULL,
      expert_review_reason TEXT,
      missing_information_json TEXT,
      calculation_method TEXT NOT NULL,
      target_yield_note TEXT,
      targets_json TEXT NOT NULL,
      soil_adjustment_notes_json TEXT NOT NULL,
      assumptions_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      application_schedule_json TEXT NOT NULL,
      estimated_cost REAL NOT NULL,
      source_references_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fertilizer_line_items (
      id TEXT PRIMARY KEY,
      recommendation_id TEXT NOT NULL,
      fertilizer_product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      grade_label TEXT NOT NULL,
      quantity_per_hectare REAL NOT NULL,
      total_quantity REAL NOT NULL,
      bag_weight_kg REAL NOT NULL,
      total_bags REAL NOT NULL,
      price_per_bag_inr REAL NOT NULL,
      estimated_price REAL NOT NULL,
      nutrients_contributed_json TEXT NOT NULL,
      FOREIGN KEY (recommendation_id) REFERENCES fertilizer_recommendations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farm_id TEXT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      language TEXT NOT NULL,
      provider TEXT NOT NULL,
      source_references_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      soil_analysis_id TEXT NOT NULL,
      recommendation_id TEXT,
      report_title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function seedReferenceAndDemoData(db: Database): void {
  // 1. Seed Crops
  for (const c of SUPPORTED_CROPS) {
    db.run(
      `INSERT OR IGNORE INTO crops (id, crop_name, seasons_json, icar_supported, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.cropName, JSON.stringify(c.seasons), c.icarSupported ? 1 : 0, c.notes],
    );
  }

  // 2. Seed Fertilizer Products (FCO 1985)
  for (const p of FERTILIZER_PRODUCTS) {
    db.run(
      `INSERT OR IGNORE INTO fertilizer_products
       (id, name, code, nitrogen_percentage, phosphorus_percentage, potassium_percentage, other_nutrients, bag_weight_kg, price_per_bag_inr, product_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        p.code,
        p.nitrogenPct,
        p.phosphorusP2O5Pct,
        p.potassiumK2OPct,
        p.otherNutrients,
        p.bagWeightKg,
        p.pricePerBagInr,
        p.productSource,
      ],
    );
  }

  // 3. Seed ICAR Crop Nutrient Standards
  for (const s of CROP_NUTRIENT_STANDARDS) {
    db.run(
      `INSERT OR IGNORE INTO crop_nutrient_standards
       (id, crop, district, season, soil_type, target_yield, nitrogen_requirement, phosphorus_requirement, potassium_requirement, source_reference, effective_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.crop,
        s.district,
        s.season,
        s.soilType,
        s.targetYield,
        s.nitrogenReqKgHa,
        s.phosphorusP2O5ReqKgHa,
        s.potassiumK2OReqKgHa,
        s.sourceReference,
        s.effectiveDate,
      ],
    );
  }

  // 4. Seed Demo All-India Farmer if not present
  const demoUserId = 'usr_demo_karnataka';
  const existingDemo = queryOne<{ id: string }>(
    db,
    `SELECT id FROM users WHERE email = ?`,
    ['demo@soilsense.in'],
  );
  const now = new Date().toISOString();

  if (!existingDemo) {
    db.run(
      `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [demoUserId, 'Ramesh Kumar', 'demo@soilsense.in', hashPassword('Farmer@2026'), 'farmer', now],
    );
    db.run(
      `INSERT INTO farmer_profiles (user_id, phone, preferred_language) VALUES (?, ?, ?)`,
      [demoUserId, '+91 98450 42108', 'en'],
    );
  }

  // Idempotent All-India demo plots (Punjab Wheat, Karnataka Rice, Maharashtra Sugarcane)
  db.run(
    `INSERT OR IGNORE INTO farms (id, user_id, farm_name, state, district, village, latitude, longitude, land_area, area_unit, area_hectares, selected_crop, crop_season, growth_stage, soil_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'farm_punjab_03',
      demoUserId,
      'Doaba Alluvial Wheat Plot — Jagraon',
      'Punjab',
      'Ludhiana',
      'Jagraon',
      30.7885,
      75.4733,
      4.0,
      'acre',
      Number((4.0 * 0.404686).toFixed(4)),
      'Wheat',
      'Rabi',
      'Pre-sowing / Basal',
      'Indo-Gangetic Alluvial Loam',
      now,
    ],
  );

  db.run(
    `INSERT OR IGNORE INTO farms (id, user_id, farm_name, state, district, village, latitude, longitude, land_area, area_unit, area_hectares, selected_crop, crop_season, growth_stage, soil_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'farm_mandya_01',
      demoUserId,
      'Cauvery Canal Plot — Maddur',
      'Karnataka',
      'Mandya',
      'Maddur',
      12.5842,
      77.0448,
      3.5,
      'acre',
      Number((3.5 * 0.404686).toFixed(4)),
      'Rice',
      'Kharif',
      'Pre-sowing / Basal',
      'Red Sandy Loam / Irrigated Paddy',
      now,
    ],
  );

  db.run(
    `INSERT OR IGNORE INTO farms (id, user_id, farm_name, state, district, village, latitude, longitude, land_area, area_unit, area_hectares, selected_crop, crop_season, growth_stage, soil_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'farm_belagavi_02',
      demoUserId,
      'Panchaganga Black Soil Block — Karvir',
      'Maharashtra',
      'Kolhapur',
      'Karvir',
      16.705,
      74.2433,
      2.0,
      'hectare',
      2.0,
      'Sugarcane',
      'Annual',
      'Pre-sowing / Basal',
      'Deep Black Vertisol',
      now,
    ],
  );
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const wasmDir = path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist');
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(wasmDir, file),
      useOldExtensionFunctions: false,
    });

    const dbPath = resolveDbPath();
    let db: Database;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    createSchema(db);
    seedReferenceAndDemoData(db);
    dbInstance = db;
    persistDb();
    return db;
  })();

  return dbInitPromise;
}

export function getPersistenceMode(): { engine: string; target: string; zeroConfig: boolean } {
  return {
    engine: 'Built-in SQLite (sql.js — zero-config, no DATABASE_URL needed)',
    target: resolveDbPath(),
    zeroConfig: true,
  };
}
