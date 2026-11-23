export type SupportedLanguage = 'en' | 'kn' | 'ta' | 'te' | 'hi';

export type AreaUnit = 'hectare' | 'acre' | 'gunta' | 'bigha';

export type CropSeason = 'Kharif' | 'Rabi' | 'Summer' | 'Annual';

export type GrowthStage = 'Pre-sowing / Basal' | 'Vegetative / Tillering' | 'Flowering / Panicle' | 'Grain Filling / Maturity';

export type NutrientStatusLevel = 'Deficient' | 'Low' | 'Sufficient' | 'High' | 'Excess' | 'Acidic' | 'Neutral' | 'Alkaline' | 'Saline' | 'Missing';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferredLanguage: SupportedLanguage;
  role: 'farmer' | 'advisor' | 'researcher' | 'admin';
  createdAt: string;
}

export interface Farm {
  id: string;
  userId: string;
  farmName: string;
  state: string;
  district: string;
  village: string;
  latitude?: number | null;
  longitude?: number | null;
  landArea: number;
  areaUnit: AreaUnit;
  areaHectares: number;
  selectedCrop: string;
  cropSeason: CropSeason;
  growthStage: GrowthStage;
  soilType?: string;
  createdAt: string;
}

export interface SoilMeasurementInput {
  parameterName:
    | 'pH'
    | 'Nitrogen'
    | 'Phosphorus'
    | 'Potassium'
    | 'EC'
    | 'OrganicCarbon'
    | 'Sulphur'
    | 'Zinc'
    | 'Iron'
    | 'Boron'
    | 'Copper'
    | 'Manganese'
    | 'Moisture';
  measuredValue: number | null;
  unit: string;
  method?: string;
}

export interface SoilParameterAssessment {
  parameterName: string;
  label: string;
  measuredValue: number | null;
  unit: string;
  normalizedValue?: number | null;
  normalizedUnit?: string;
  status: NutrientStatusLevel;
  thresholdRange: string;
  regionalMedian?: number | null;
  regionalStatus?: string;
  explanation: string;
  sourceReference: string;
}

export interface SoilAnalysisRecord {
  id: string;
  soilSampleId: string;
  farmId: string;
  farmName: string;
  state?: string;
  district: string;
  crop: string;
  sampleDate: string;
  sampleDepth: string;
  labName: string;
  extractionMethod: string;
  verificationStatus: 'verified' | 'pending_review';
  measurements: SoilMeasurementInput[];
  assessments: SoilParameterAssessment[];
  missingParameters: string[];
  overallHealthSummary: string;
  deficienciesCount: number;
  excessCount: number;
  sufficientCount: number;
  sourceReferences: string[];
  createdAt: string;
}

export interface FertilizerLineItem {
  id?: string;
  fertilizerProductId: string;
  productName: string;
  gradeLabel: string;
  quantityPerHectareKg: number;
  totalQuantityKg: number;
  bagWeightKg: number;
  totalBags: number;
  pricePerBagInr: number;
  estimatedPriceInr: number;
  nutrientsContributedKgPerHa: {
    N: number;
    P2O5: number;
    K2O: number;
    Zn?: number;
    S?: number;
  };
}

export interface ApplicationSplitStage {
  stage: string;
  timing: string;
  instructions: string;
  products: Array<{ productName: string; totalKg: number }>;
}

export interface FertilizerRecommendationRecord {
  id: string;
  soilAnalysisId: string;
  farmId: string;
  farmName: string;
  state?: string;
  district: string;
  crop: string;
  season: CropSeason;
  growthStage: GrowthStage;
  landAreaHectares: number;
  landAreaDisplay: string;
  status: 'calculated' | 'expert_review_required';
  expertReviewReason?: string;
  missingInformation?: string[];
  calculationMethod: string;
  targetYieldNote?: string;
  targetsKgPerHa: {
    N: number;
    P2O5: number;
    K2O: number;
  };
  soilAdjustmentNotes: string[];
  lineItems: FertilizerLineItem[];
  totalEstimatedCostInr: number;
  applicationSchedule: ApplicationSplitStage[];
  assumptions: string[];
  warnings: string[];
  sourceReferences: string[];
  createdAt: string;
}

export interface ChatSourceCitation {
  id: string;
  title: string;
  organization: string;
  category: string;
  excerpt: string;
  referenceUrl?: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  language: SupportedLanguage;
  provider: 'gemini' | 'nvidia' | 'error';
  sourceReferences: ChatSourceCitation[];
  createdAt: string;
}

export interface ChatSessionRecord {
  id: string;
  userId: string;
  farmId?: string | null;
  title: string;
  createdAt: string;
  messages: ChatMessageRecord[];
}

export interface ReportRecord {
  id: string;
  userId: string;
  farmId: string;
  farmName: string;
  crop: string;
  soilAnalysisId: string;
  recommendationId?: string | null;
  reportTitle: string;
  createdAt: string;
}

export interface WeatherAdvisoryResponse {
  district: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  rainfallNext24hMm: number;
  rainfallNext72hMm: number;
  conditionLabel: string;
  irrigationAdvice: string;
  fertilizerTimingWarning: string;
  source: string;
  fetchedAt: string;
}

export interface CropSuitabilityResult {
  crop: string;
  suitabilityScore: number;
  suitabilityBand: 'High Match' | 'Moderate Match' | 'Low Match';
  matchingFactors: string[];
  limitingFactors: string[];
  limitationsDisclaimer: string;
}

export interface DatasetRegistryEntry {
  datasetId: string;
  name: string;
  sourceOrganization: string;
  url: string;
  licenseStatus: string;
  coverage: string;
  recordCount: string;
  intendedUse: string;
  prohibitedUse: string;
}

export interface KarnatakaDistrictProfile {
  state: string;
  district: string;
  regionZone: string;
  latitude: number;
  longitude: number;
  sampleCountPilot: number;
  dominantSoilType: string;
  medianPh: number;
  medianEc: number;
  medianOcPct: number;
  medianNitrogenKgHa: number;
  medianPhosphorusKgHa: number;
  medianPotassiumKgHa: number;
  medianZincPpm: number;
  medianSulphurPpm: number;
  medianBoronPpm: number;
  deficiencyHotspots: string[];
}

export type IndianDistrictProfile = KarnatakaDistrictProfile;
