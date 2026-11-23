import crypto from 'crypto';
import type {
  AreaUnit,
  CropSuitabilityResult,
  NutrientStatusLevel,
  SoilMeasurementInput,
  SoilParameterAssessment,
} from '../../shared/types.js';
import {
  CROP_SUITABILITY_ENVELOPES,
  INDIA_DISTRICTS,
} from '../data/agronomicData.js';

export const REQUIRED_SOIL_PARAMETERS: Array<{
  key: SoilMeasurementInput['parameterName'];
  label: string;
  canonicalUnit: string;
  validMin: number;
  validMax: number;
}> = [
  { key: 'pH', label: 'Soil pH', canonicalUnit: 'pH', validMin: 3.0, validMax: 10.5 },
  { key: 'Nitrogen', label: 'Available Nitrogen (N)', canonicalUnit: 'kg/ha', validMin: 0, validMax: 1500 },
  { key: 'Phosphorus', label: 'Available Phosphorus (P)', canonicalUnit: 'kg/ha', validMin: 0, validMax: 300 },
  { key: 'Potassium', label: 'Available Potassium (K)', canonicalUnit: 'kg/ha', validMin: 0, validMax: 2000 },
  { key: 'EC', label: 'Electrical Conductivity (EC)', canonicalUnit: 'dS/m', validMin: 0, validMax: 20 },
  { key: 'OrganicCarbon', label: 'Organic Carbon (OC)', canonicalUnit: '%', validMin: 0, validMax: 10 },
  { key: 'Sulphur', label: 'Available Sulphur (S)', canonicalUnit: 'ppm', validMin: 0, validMax: 500 },
  { key: 'Zinc', label: 'DTPA Zinc (Zn)', canonicalUnit: 'ppm', validMin: 0, validMax: 50 },
  { key: 'Iron', label: 'DTPA Iron (Fe)', canonicalUnit: 'ppm', validMin: 0, validMax: 200 },
  { key: 'Boron', label: 'Hot-Water Boron (B)', canonicalUnit: 'ppm', validMin: 0, validMax: 20 },
  { key: 'Copper', label: 'DTPA Copper (Cu)', canonicalUnit: 'ppm', validMin: 0, validMax: 50 },
  { key: 'Manganese', label: 'DTPA Manganese (Mn)', canonicalUnit: 'ppm', validMin: 0, validMax: 200 },
  { key: 'Moisture', label: 'Soil Moisture', canonicalUnit: '%', validMin: 0, validMax: 100 },
];

export function convertAreaToHectares(area: number, unit: AreaUnit): number {
  if (unit === 'hectare') return Number(area.toFixed(4));
  if (unit === 'acre') return Number((area * 0.404686).toFixed(4));
  if (unit === 'bigha') return Number((area * 0.250838).toFixed(4)); // Standard Indian Pucca Bigha (~0.62 acre)
  // 1 gunta = 1/40 acre = 0.01011715 hectare
  return Number((area * 0.01011715).toFixed(4));
}

export function validateSoilMeasurements(
  measurements: SoilMeasurementInput[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return { valid: false, errors: ['At least one soil measurement must be provided.'] };
  }

  let providedCount = 0;
  for (const m of measurements) {
    const spec = REQUIRED_SOIL_PARAMETERS.find((p) => p.key === m.parameterName);
    if (!spec) {
      errors.push(`Unsupported soil parameter: ${m.parameterName}`);
      continue;
    }
    if (m.measuredValue === null || m.measuredValue === undefined || Number.isNaN(m.measuredValue)) {
      continue;
    }
    providedCount += 1;
    if (typeof m.measuredValue !== 'number' || !Number.isFinite(m.measuredValue)) {
      errors.push(`${spec.label} must be a valid number.`);
      continue;
    }
    if (m.measuredValue < spec.validMin || m.measuredValue > spec.validMax) {
      errors.push(
        `${spec.label} value (${m.measuredValue} ${m.unit}) is outside realistic agronomic bounds [${spec.validMin} – ${spec.validMax}].`,
      );
    }
    if (!m.unit || m.unit.trim().length === 0) {
      errors.push(`${spec.label} must explicitly record its measurement unit.`);
    }
  }

  if (providedCount === 0) {
    errors.push('Enter at least one numeric soil parameter (such as pH, N, P, or K) to run soil analysis.');
  }

  return { valid: errors.length === 0, errors };
}

export function createSampleFingerprint(
  farmId: string,
  sampleDate: string,
  measurements: SoilMeasurementInput[],
): string {
  const canonical = measurements
    .filter((m) => m.measuredValue !== null && m.measuredValue !== undefined)
    .map((m) => `${m.parameterName}:${Number(m.measuredValue).toFixed(3)}:${m.unit.trim().toLowerCase()}`)
    .sort()
    .join('|');
  return crypto
    .createHash('sha256')
    .update(`${farmId}::${sampleDate}::${canonical}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Preserves original unit; only applies an explicit, transparent conversion for threshold comparison
 * when a lab reports NPK in mg/kg or ppm (standard 15cm furrow slice factor: 1 mg/kg ≈ 2.24 kg/ha).
 */
function normalizeForThreshold(
  param: SoilMeasurementInput['parameterName'],
  value: number,
  unit: string,
): { normalizedValue: number; normalizedUnit: string; unitConversionNote?: string } {
  const lowerUnit = unit.trim().toLowerCase();
  if (param === 'Nitrogen' || param === 'Phosphorus' || param === 'Potassium') {
    if (lowerUnit === 'mg/kg' || lowerUnit === 'ppm') {
      const converted = Number((value * 2.24).toFixed(2));
      return {
        normalizedValue: converted,
        normalizedUnit: 'kg/ha',
        unitConversionNote: `Original lab value ${value} ${unit} preserved; evaluated at ~${converted} kg/ha (15 cm furrow slice factor 2.24x).`,
      };
    }
    if (lowerUnit === 'kg/acre') {
      const converted = Number((value * 2.47105).toFixed(2));
      return {
        normalizedValue: converted,
        normalizedUnit: 'kg/ha',
        unitConversionNote: `Original lab value ${value} ${unit} preserved; evaluated at ${converted} kg/ha (2.471x acre-to-hectare).`,
      };
    }
    return { normalizedValue: value, normalizedUnit: 'kg/ha' };
  }

  if (
    param === 'Sulphur' ||
    param === 'Zinc' ||
    param === 'Iron' ||
    param === 'Boron' ||
    param === 'Copper' ||
    param === 'Manganese'
  ) {
    if (lowerUnit === 'kg/ha') {
      const converted = Number((value / 2.24).toFixed(2));
      return {
        normalizedValue: converted,
        normalizedUnit: 'ppm',
        unitConversionNote: `Original lab value ${value} kg/ha preserved; evaluated at ~${converted} ppm.`,
      };
    }
    return { normalizedValue: value, normalizedUnit: 'ppm' };
  }

  return { normalizedValue: value, normalizedUnit: unit };
}

export function evaluateSoilAnalysis(
  district: string,
  measurements: SoilMeasurementInput[],
  state?: string,
): {
  assessments: SoilParameterAssessment[];
  missingParameters: string[];
  overallHealthSummary: string;
  deficienciesCount: number;
  excessCount: number;
  sufficientCount: number;
  sourceReferences: string[];
} {
  const districtProfile =
    INDIA_DISTRICTS.find((d) => d.district.toLowerCase() === district.toLowerCase()) ??
    (state ? INDIA_DISTRICTS.find((d) => d.state.toLowerCase() === state.toLowerCase()) : undefined);

  const byParam = new Map<string, SoilMeasurementInput>();
  for (const m of measurements) {
    byParam.set(m.parameterName, m);
  }

  const assessments: SoilParameterAssessment[] = [];
  const missingParameters: string[] = [];
  let deficienciesCount = 0;
  let excessCount = 0;
  let sufficientCount = 0;

  const shcRef = 'ICAR Soil Health Card National Nutrient Rating Thresholds (MoA&FW)';
  const regionalRef = districtProfile
    ? `All-India Soil Health Portal Regional Baseline (${districtProfile.district}, ${districtProfile.state} — MoA&FW)`
    : 'All-India Soil Health Portal National Baseline (MoA&FW)';

  for (const spec of REQUIRED_SOIL_PARAMETERS) {
    const input = byParam.get(spec.key);
    if (!input || input.measuredValue === null || input.measuredValue === undefined) {
      missingParameters.push(spec.label);
      assessments.push({
        parameterName: spec.key,
        label: spec.label,
        measuredValue: null,
        unit: spec.canonicalUnit,
        status: 'Missing',
        thresholdRange: 'Not tested in this report',
        regionalMedian: null,
        explanation: `${spec.label} was not provided in this soil sample. Consider including it in your next laboratory test.`,
        sourceReference: shcRef,
      });
      continue;
    }

    const { normalizedValue, normalizedUnit, unitConversionNote } = normalizeForThreshold(
      spec.key,
      input.measuredValue,
      input.unit,
    );

    let status: NutrientStatusLevel = 'Sufficient';
    let thresholdRange = '';
    let explanation = '';
    let regionalMedian: number | null = null;

    switch (spec.key) {
      case 'pH': {
        thresholdRange = '6.5 – 7.5 (Neutral)';
        regionalMedian = districtProfile?.medianPh ?? null;
        if (normalizedValue < 5.5) {
          status = 'Acidic';
          deficienciesCount += 1;
          explanation = 'Strongly acidic soil; phosphorus availability is reduced and agricultural liming may be needed.';
        } else if (normalizedValue < 6.5) {
          status = 'Acidic';
          deficienciesCount += 1;
          explanation = 'Slightly acidic soil; monitor calcium/boron availability and incorporate organic matter.';
        } else if (normalizedValue <= 7.5) {
          status = 'Neutral';
          sufficientCount += 1;
          explanation = 'Optimal neutral soil reaction supporting balanced macro- and micronutrient uptake.';
        } else if (normalizedValue <= 8.5) {
          status = 'Alkaline';
          excessCount += 1;
          explanation = 'Moderately alkaline soil; DTPA Zinc and Iron availability often drops — monitor micronutrients.';
        } else {
          status = 'Alkaline';
          excessCount += 1;
          explanation = 'Strongly alkaline / sodic tendency; consult local Krishi Vigyan Kendra for gypsum amendment.';
        }
        break;
      }
      case 'EC': {
        thresholdRange = '< 1.0 dS/m (Normal)';
        regionalMedian = districtProfile?.medianEc ?? null;
        if (normalizedValue < 1.0) {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Normal soluble salt concentration safe for all major field crops.';
        } else if (normalizedValue <= 2.0) {
          status = 'High';
          excessCount += 1;
          explanation = 'Slightly elevated salinity; sensitive crops may experience germination stress without good drainage.';
        } else {
          status = 'Saline';
          excessCount += 1;
          explanation = 'Saline soil condition; ensure leaching drainage and avoid excess salt-index fertilizer placement.';
        }
        break;
      }
      case 'OrganicCarbon': {
        thresholdRange = '0.50 – 0.75% (Medium)';
        regionalMedian = districtProfile?.medianOcPct ?? null;
        if (normalizedValue < 0.5) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Low soil organic carbon; incorporate 5–10 t/ha FYM, compost, or green manure to restore soil structure.';
        } else if (normalizedValue <= 0.75) {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Medium organic carbon supporting steady microbial nutrient cycling.';
        } else {
          status = 'High';
          sufficientCount += 1;
          explanation = 'High organic carbon reserve indicating healthy soil biological activity and water retention.';
        }
        break;
      }
      case 'Nitrogen': {
        thresholdRange = '280 – 560 kg/ha (Medium)';
        regionalMedian = districtProfile?.medianNitrogenKgHa ?? null;
        if (normalizedValue < 280) {
          status = 'Low';
          deficienciesCount += 1;
          explanation = 'Low available nitrogen; crop will respond to ICAR-adjusted split nitrogen application.';
        } else if (normalizedValue <= 560) {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Medium available nitrogen; follow standard district crop recommendation in splits.';
        } else {
          status = 'High';
          excessCount += 1;
          explanation = 'High available nitrogen; reduce basal nitrogen dose by 25% per ICAR rules to avoid lodging and leaching.';
        }
        break;
      }
      case 'Phosphorus': {
        thresholdRange = '10 – 25 kg/ha (Medium)';
        regionalMedian = districtProfile?.medianPhosphorusKgHa ?? null;
        if (normalizedValue < 10) {
          status = 'Low';
          deficienciesCount += 1;
          explanation = 'Low available phosphorus; apply full basal phosphorus (DAP or SSP) near root zone.';
        } else if (normalizedValue <= 25) {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Medium available phosphorus; maintain standard ICAR basal P2O5 dose.';
        } else {
          status = 'High';
          excessCount += 1;
          explanation = 'High soil phosphorus buildup; reduce P2O5 dose by 25% to prevent Zinc antagonism and save cost.';
        }
        break;
      }
      case 'Potassium': {
        thresholdRange = '108 – 280 kg/ha (Medium)';
        regionalMedian = districtProfile?.medianPotassiumKgHa ?? null;
        if (normalizedValue < 108) {
          status = 'Low';
          deficienciesCount += 1;
          explanation = 'Low available potassium; increase K2O dose by 25% per ICAR guidelines for stronger stem & grain fill.';
        } else if (normalizedValue <= 280) {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Medium available potassium; apply standard district crop K2O recommendation.';
        } else {
          status = 'High';
          excessCount += 1;
          explanation = 'High potassium reserve (common in Indian black Vertisols and alluvial belts); reduce K2O application by 25%.';
        }
        break;
      }
      case 'Sulphur': {
        thresholdRange = '>= 10.0 ppm (Sufficient)';
        regionalMedian = districtProfile?.medianSulphurPpm ?? null;
        if (normalizedValue < 10.0) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient available sulphur; prefer Single Super Phosphate (SSP, 11% S) or gypsum amendment.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient available sulphur for protein and oil synthesis.';
        }
        break;
      }
      case 'Zinc': {
        thresholdRange = '>= 0.60 ppm (DTPA Critical Limit)';
        regionalMedian = districtProfile?.medianZincPpm ?? null;
        if (normalizedValue < 0.6) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient DTPA Zinc (widespread across Indian agricultural soils); include Zinc Sulphate Heptahydrate separately from P fertilizers.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient DTPA Zinc above the 0.60 ppm critical threshold.';
        }
        break;
      }
      case 'Iron': {
        thresholdRange = '>= 4.50 ppm (DTPA Critical Limit)';
        if (normalizedValue < 4.5) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient available Iron; watch for interveinal yellowing on young leaves, especially in alkaline black soils.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient DTPA Iron for chlorophyll synthesis.';
        }
        break;
      }
      case 'Boron': {
        thresholdRange = '0.50 – 2.00 ppm (Optimal)';
        regionalMedian = districtProfile?.medianBoronPpm ?? null;
        if (normalizedValue < 0.5) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient hot-water Boron; can impair flowering and grain setting. Apply soil borax cautiously only if advised.';
        } else if (normalizedValue > 2.0) {
          status = 'Excess';
          excessCount += 1;
          explanation = 'Elevated Boron; avoid boronated fertilizers to prevent leaf tip toxicity.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient Boron for pollination and cell wall stability.';
        }
        break;
      }
      case 'Copper': {
        thresholdRange = '>= 0.20 ppm (DTPA Critical Limit)';
        if (normalizedValue < 0.2) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient DTPA Copper below 0.20 ppm critical limit.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient DTPA Copper.';
        }
        break;
      }
      case 'Manganese': {
        thresholdRange = '>= 2.00 ppm (DTPA Critical Limit)';
        if (normalizedValue < 2.0) {
          status = 'Deficient';
          deficienciesCount += 1;
          explanation = 'Deficient DTPA Manganese below 2.0 ppm critical limit.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Sufficient DTPA Manganese.';
        }
        break;
      }
      case 'Moisture': {
        thresholdRange = '15 – 45% (Field Working Context)';
        if (normalizedValue < 12) {
          status = 'Low';
          explanation = 'Low moisture at sampling; ensure adequate soil moisture before top-dressing nitrogen fertilizers.';
        } else {
          status = 'Sufficient';
          sufficientCount += 1;
          explanation = 'Adequate field moisture recorded at time of sampling.';
        }
        break;
      }
    }

    const fullExplanation = unitConversionNote ? `${explanation} ${unitConversionNote}` : explanation;
    const baselineLabel = districtProfile
      ? districtProfile.district.toLowerCase() === district.toLowerCase()
        ? `${districtProfile.district} median`
        : `${districtProfile.state} (${districtProfile.district}) regional median`
      : `${district} median`;
    let regionalStatus: string | undefined;
    if (regionalMedian !== null) {
      const diffPct = Math.round(((normalizedValue - regionalMedian) / regionalMedian) * 100);
      if (Math.abs(diffPct) <= 10) {
        regionalStatus = `Near ${baselineLabel} (${regionalMedian})`;
      } else if (diffPct > 10) {
        regionalStatus = `${diffPct}% above ${baselineLabel} (${regionalMedian})`;
      } else {
        regionalStatus = `${Math.abs(diffPct)}% below ${baselineLabel} (${regionalMedian})`;
      }
    }

    assessments.push({
      parameterName: spec.key,
      label: spec.label,
      measuredValue: input.measuredValue,
      unit: input.unit,
      normalizedValue,
      normalizedUnit,
      status,
      thresholdRange,
      regionalMedian,
      regionalStatus,
      explanation: fullExplanation,
      sourceReference: regionalMedian !== null ? `${shcRef}; ${regionalRef}` : shcRef,
    });
  }

  const deficientLabels = assessments
    .filter((a) => a.status === 'Deficient' || a.status === 'Low')
    .map((a) => a.label.split(' ')[1] ?? a.label);
  const excessLabels = assessments
    .filter((a) => a.status === 'High' || a.status === 'Excess' || a.status === 'Alkaline' || a.status === 'Saline')
    .map((a) => a.label);

  const locationDisplay = state ? `${district}, ${state}` : district;
  let overallHealthSummary = '';
  if (deficienciesCount === 0 && excessCount === 0) {
    overallHealthSummary = `Balanced soil fertility profile for ${locationDisplay}. Maintain organic matter and follow standard ICAR crop split schedules.`;
  } else {
    const parts: string[] = [];
    if (deficienciesCount > 0) {
      parts.push(`${deficienciesCount} parameter(s) flagged low/deficient (${deficientLabels.slice(0, 4).join(', ')})`);
    }
    if (excessCount > 0) {
      parts.push(`${excessCount} parameter(s) elevated/alkaline (${excessLabels.slice(0, 3).join(', ')})`);
    }
    if (missingParameters.length > 0) {
      parts.push(`${missingParameters.length} optional parameter(s) not tested`);
    }
    overallHealthSummary = `${parts.join('; ')}. Deterministic ICAR fertilizer adjustments applied where validated rules exist.`;
  }

  return {
    assessments,
    missingParameters,
    overallHealthSummary,
    deficienciesCount,
    excessCount,
    sufficientCount,
    sourceReferences: [shcRef, regionalRef],
  };
}

export function evaluateCropSuitability(input: {
  nitrogenKgHa: number;
  phosphorusKgHa: number;
  potassiumKgHa: number;
  ph: number;
  temperatureC: number;
  humidityPct: number;
  rainfallMm: number;
}): CropSuitabilityResult[] {
  const disclaimer =
    'Exploratory benchmark derived from Dataset C (Crop Recommendation Dataset, Apache 2.0). This indicator does not predict actual farm-level yield, guarantee crop success, or calculate fertilizer quantities.';

  const scoreDimension = (val: number, [min, max]: [number, number]): number => {
    if (val >= min && val <= max) return 1;
    const span = Math.max(max - min, 1);
    const dist = val < min ? min - val : val - max;
    return Math.max(0, 1 - dist / span);
  };

  const results: CropSuitabilityResult[] = CROP_SUITABILITY_ENVELOPES.map((env) => {
    const dims: Array<{ name: string; score: number; detail: string }> = [
      { name: 'Nitrogen', score: scoreDimension(input.nitrogenKgHa, env.nRange), detail: `N ${input.nitrogenKgHa} vs ${env.nRange[0]}–${env.nRange[1]} kg/ha` },
      { name: 'Phosphorus', score: scoreDimension(input.phosphorusKgHa, env.pRange), detail: `P ${input.phosphorusKgHa} vs ${env.pRange[0]}–${env.pRange[1]} kg/ha` },
      { name: 'Potassium', score: scoreDimension(input.potassiumKgHa, env.kRange), detail: `K ${input.potassiumKgHa} vs ${env.kRange[0]}–${env.kRange[1]} kg/ha` },
      { name: 'pH', score: scoreDimension(input.ph, env.phRange), detail: `pH ${input.ph} vs ${env.phRange[0]}–${env.phRange[1]}` },
      { name: 'Temperature', score: scoreDimension(input.temperatureC, env.tempRange), detail: `${input.temperatureC}°C vs ${env.tempRange[0]}–${env.tempRange[1]}°C` },
      { name: 'Humidity', score: scoreDimension(input.humidityPct, env.humidityRange), detail: `${input.humidityPct}% vs ${env.humidityRange[0]}–${env.humidityRange[1]}%` },
      { name: 'Rainfall', score: scoreDimension(input.rainfallMm, env.rainfallRange), detail: `${input.rainfallMm}mm vs ${env.rainfallRange[0]}–${env.rainfallRange[1]}mm` },
    ];

    const avg = dims.reduce((acc, d) => acc + d.score, 0) / dims.length;
    const suitabilityScore = Math.round(avg * 100);
    const suitabilityBand: CropSuitabilityResult['suitabilityBand'] =
      suitabilityScore >= 78 ? 'High Match' : suitabilityScore >= 55 ? 'Moderate Match' : 'Low Match';

    return {
      crop: env.crop,
      suitabilityScore,
      suitabilityBand,
      matchingFactors: dims.filter((d) => d.score >= 0.75).map((d) => d.detail),
      limitingFactors: dims.filter((d) => d.score < 0.75).map((d) => d.detail),
      limitationsDisclaimer: disclaimer,
    };
  });

  results.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  return results.slice(0, 6);
}
