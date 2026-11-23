import assert from 'assert';
import { runKarnatakaDatasetValidation } from '../services/datasetPreprocessor.js';
import { calculateFertilizerRecommendation } from '../services/fertilizerService.js';
import { buildAdvisoryPdfBuffer } from '../services/reportService.js';
import { evaluateSoilAnalysis, validateSoilMeasurements } from '../services/soilService.js';
import type { Farm, SoilAnalysisRecord, SoilMeasurementInput, UserProfile } from '../../shared/types.js';

async function runAllTests() {
  console.log('Running SoilSense AI Backend & Dataset Verification Tests...\n');

  // 1. Dataset Preprocessing Validation (Dataset A All-India Soil Health Pilot)
  const qa = runKarnatakaDatasetValidation(undefined, true);
  assert.strictEqual(qa.totalRawRows, 15, 'Expected 15 raw All-India pilot rows');
  assert.strictEqual(qa.duplicateRowsRemoved, 1, 'Expected 1 duplicate row removed');
  assert.strictEqual(qa.outlierRowsFlagged, 1, 'Expected 1 pH outlier row flagged');
  assert.strictEqual(qa.validCleanedRows, 13, 'Expected 13 valid cleaned All-India rows');
  assert.ok(qa.statesCovered.length >= 13, 'Expected at least 13 distinct Indian states covered');
  assert.strictEqual(qa.unitConsistencyVerified, true, 'Expected kg/ha unit consistency');
  console.log(`PASS [1/5] All-India dataset preprocessing: ${qa.validCleanedRows} clean rows across ${qa.statesCovered.length} states verified.`);

  // 2. Soil Input Validation & Unit Preservation
  const badRes = validateSoilMeasurements([
    { parameterName: 'pH', measuredValue: 13.4, unit: 'pH' },
  ]);
  assert.strictEqual(badRes.valid, false, 'Out-of-range pH 13.4 must fail validation');

  const mgKgMeasurements: SoilMeasurementInput[] = [
    { parameterName: 'pH', measuredValue: 6.9, unit: 'pH' },
    { parameterName: 'Nitrogen', measuredValue: 100, unit: 'mg/kg' },
    { parameterName: 'Phosphorus', measuredValue: 16, unit: 'kg/ha' },
    { parameterName: 'Potassium', measuredValue: 240, unit: 'kg/ha' },
    { parameterName: 'Zinc', measuredValue: 0.45, unit: 'ppm' },
  ];
  const evalOut = evaluateSoilAnalysis('Mandya', mgKgMeasurements, 'Karnataka');
  const nAssessment = evalOut.assessments.find((a) => a.parameterName === 'Nitrogen')!;
  assert.strictEqual(nAssessment.unit, 'mg/kg', 'Original mg/kg unit must be preserved');
  assert.strictEqual(nAssessment.normalizedValue, 224, '100 mg/kg should normalize to 224 kg/ha (2.24x factor)');
  assert.strictEqual(nAssessment.status, 'Low', '224 kg/ha N must classify as Low');
  console.log('PASS [2/5] Soil validation, ICAR thresholds, and explicit mg/kg unit preservation verified.');

  // 3. Deterministic Fertilizer Calculation Engine & Multi-Nutrient DAP Nitrogen Credit (All-India)
  const fertPlan = calculateFertilizerRecommendation({
    soilAnalysisId: 'anl_test',
    farmId: 'farm_test',
    farmName: 'Mandya Test Plot',
    state: 'Karnataka',
    district: 'Mandya',
    crop: 'Rice',
    season: 'Kharif',
    growthStage: 'Pre-sowing / Basal',
    landAreaHectares: 1.0,
    landAreaDisplay: '1 hectare',
    assessments: evalOut.assessments,
    preferredPSource: 'DAP',
    includeZincIfDeficient: true,
  });

  assert.strictEqual(fertPlan.status, 'calculated', 'Mandya Rice Kharif must compute deterministically');
  const dapItem = fertPlan.lineItems.find((l) => l.productName.includes('DAP'))!;
  const ureaItem = fertPlan.lineItems.find((l) => l.productName.includes('Urea'))!;
  assert.strictEqual(fertPlan.targetsKgPerHa.N, 150, 'Low N should adjust Mandya Rice N from 120 to 150 kg/ha');
  assert.ok(dapItem.nutrientsContributedKgPerHa.N > 23 && dapItem.nutrientsContributedKgPerHa.N < 24, 'DAP must credit ~23.5 kg N/ha');
  assert.ok(ureaItem.quantityPerHectareKg < 280, 'Urea must be reduced by DAP nitrogen credit');
  assert.ok(fertPlan.lineItems.some((l) => l.productName.includes('Zinc')), 'Zinc Sulphate must be included when DTPA Zn < 0.60 ppm');

  // Also verify North India (Ludhiana, Punjab Wheat) & national ICAR fallback (custom district in Odisha)
  const punjabWheat = calculateFertilizerRecommendation({
    soilAnalysisId: 'anl_pb',
    farmId: 'farm_pb',
    farmName: 'Ludhiana Wheat Plot',
    state: 'Punjab',
    district: 'Ludhiana',
    crop: 'Wheat',
    season: 'Rabi',
    growthStage: 'Pre-sowing / Basal',
    landAreaHectares: 1.0,
    landAreaDisplay: '1 hectare',
    assessments: evalOut.assessments,
    preferredPSource: 'auto',
  });
  assert.strictEqual(punjabWheat.status, 'calculated', 'Ludhiana Punjab Wheat Rabi must calculate deterministically');
  assert.strictEqual(punjabWheat.targetsKgPerHa.N, 156.3, 'Punjab PAU Wheat base 125 +25% Low N = 156.3 kg/ha');

  const odishaCustomRice = calculateFertilizerRecommendation({
    soilAnalysisId: 'anl_od',
    farmId: 'farm_od',
    farmName: 'Puri Paddy Plot',
    state: 'Odisha',
    district: 'Puri',
    crop: 'Rice',
    season: 'Kharif',
    growthStage: 'Pre-sowing / Basal',
    landAreaHectares: 1.0,
    landAreaDisplay: '1 hectare',
    assessments: evalOut.assessments,
  });
  assert.strictEqual(odishaCustomRice.status, 'calculated', 'Custom district in any Indian state resolves via state/All-India ICAR Dataset D match');
  console.log('PASS [3/5] Deterministic All-India ICAR/FCO Fertilizer Engine & DAP 18% N credit verified.');

  // 4. Calculation Safety Guardrail (Unsupported crop must NOT invent doses anywhere in India)
  const unsafeCropPlan = calculateFertilizerRecommendation({
    soilAnalysisId: 'anl_test',
    farmId: 'farm_test',
    farmName: 'Vidarbha Cotton Plot',
    state: 'Maharashtra',
    district: 'Nagpur',
    crop: 'Cotton',
    season: 'Kharif',
    growthStage: 'Pre-sowing / Basal',
    landAreaHectares: 2.0,
    landAreaDisplay: '2 hectare',
    assessments: evalOut.assessments,
  });
  assert.strictEqual(unsafeCropPlan.status, 'expert_review_required', 'Unsupported crop must trigger expert_review_required');
  assert.strictEqual(unsafeCropPlan.lineItems.length, 0, 'Safety guardrail must never invent fertilizer line items');
  console.log('PASS [4/5] Calculation Safety Guardrail verified (unsupported crop flagged, 0 invented doses).');

  // 5. PDF Report Generation
  const dummyUser: UserProfile = {
    id: 'u1',
    name: 'Test Farmer',
    email: 'test@soilsense.in',
    preferredLanguage: 'en',
    role: 'farmer',
    createdAt: new Date().toISOString(),
  };
  const dummyFarm: Farm = {
    id: 'f1',
    userId: 'u1',
    farmName: 'Mandya Test Plot',
    state: 'Karnataka',
    district: 'Mandya',
    village: 'Maddur',
    landArea: 1,
    areaUnit: 'hectare',
    areaHectares: 1,
    selectedCrop: 'Rice',
    cropSeason: 'Kharif',
    growthStage: 'Pre-sowing / Basal',
    createdAt: new Date().toISOString(),
  };
  const dummyAnalysis: SoilAnalysisRecord = {
    id: 'anl_test',
    soilSampleId: 'smp_test',
    farmId: 'f1',
    farmName: 'Mandya Test Plot',
    district: 'Mandya',
    crop: 'Rice',
    sampleDate: '2026-11-23',
    sampleDepth: '0–15 cm',
    labName: 'Mandya SHC Lab',
    extractionMethod: 'ICAR SHC',
    verificationStatus: 'verified',
    measurements: mgKgMeasurements,
    assessments: evalOut.assessments,
    missingParameters: evalOut.missingParameters,
    overallHealthSummary: evalOut.overallHealthSummary,
    deficienciesCount: evalOut.deficienciesCount,
    excessCount: evalOut.excessCount,
    sufficientCount: evalOut.sufficientCount,
    sourceReferences: evalOut.sourceReferences,
    createdAt: new Date().toISOString(),
  };

  const pdfBuffer = await buildAdvisoryPdfBuffer({
    farmer: dummyUser,
    farm: dummyFarm,
    analysis: dummyAnalysis,
    recommendation: { ...fertPlan, id: 'rec_test', createdAt: new Date().toISOString() },
    reportTitle: 'Verification Report',
  });
  assert.ok(pdfBuffer.subarray(0, 5).toString('utf-8') === '%PDF-', 'Generated buffer must be a valid PDF document');
  assert.ok(pdfBuffer.length > 2000, 'Generated PDF must contain complete report sections');
  console.log(`PASS [5/5] PDFKit report generation verified (${pdfBuffer.length} bytes, valid %PDF header).`);

  console.log('\nAll 5 backend & dataset verification suites passed.');
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
