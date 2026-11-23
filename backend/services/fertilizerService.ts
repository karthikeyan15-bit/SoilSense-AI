import type {
  ApplicationSplitStage,
  CropSeason,
  FertilizerLineItem,
  FertilizerRecommendationRecord,
  GrowthStage,
  SoilParameterAssessment,
} from '../../shared/types.js';
import {
  CROP_NUTRIENT_STANDARDS,
  FERTILIZER_PRODUCTS,
  type CropNutrientStandardSeed,
  type FertilizerProductSeed,
} from '../data/agronomicData.js';

export interface FertilizerCalculationInput {
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
  assessments: SoilParameterAssessment[];
  preferredPSource?: 'auto' | 'DAP' | 'SSP';
  includeZincIfDeficient?: boolean;
  customPricesPerBagInr?: Partial<Record<'UREA' | 'DAP' | 'MOP' | 'SSP' | 'ZNSO4', number>>;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function findValidatedStandard(
  crop: string,
  district: string,
  season: CropSeason,
  state?: string,
): CropNutrientStandardSeed | null {
  const normCrop = crop.trim().toLowerCase();
  const normDist = district.trim().toLowerCase();
  const normState = (state || '').trim().toLowerCase();
  const normSeason = season.trim().toLowerCase();

  // 1. Exact District + Crop + Season match
  const exactDistrict = CROP_NUTRIENT_STANDARDS.find(
    (s) =>
      s.crop.toLowerCase() === normCrop &&
      s.district.toLowerCase() === normDist &&
      s.season.toLowerCase() === normSeason,
  );
  if (exactDistrict) return exactDistrict;

  // 2. Annual crop (Sugarcane) exact District match regardless of planting season label
  if (normCrop === 'sugarcane') {
    const annualDistrict = CROP_NUTRIENT_STANDARDS.find(
      (s) => s.crop.toLowerCase() === normCrop && s.district.toLowerCase() === normDist,
    );
    if (annualDistrict) return annualDistrict;
  }

  // 3. Matching Indian State + Crop + Season ICAR reference
  if (normState) {
    const stateMatch = CROP_NUTRIENT_STANDARDS.find(
      (s) =>
        s.crop.toLowerCase() === normCrop &&
        s.state.toLowerCase() === normState &&
        (s.season.toLowerCase() === normSeason || normCrop === 'sugarcane'),
    );
    if (stateMatch) return stateMatch;
  }

  // 4. All-India ICAR-IISS National General Recommendation for the 5 validated Dataset D crops & matching season
  const nationalMatch = CROP_NUTRIENT_STANDARDS.find(
    (s) =>
      s.crop.toLowerCase() === normCrop &&
      s.state === 'All-India General' &&
      (s.season.toLowerCase() === normSeason || normCrop === 'sugarcane'),
  );
  if (nationalMatch) return nationalMatch;

  return null;
}

function buildSplitSchedule(
  crop: string,
  lineItems: FertilizerLineItem[],
): ApplicationSplitStage[] {
  const urea = lineItems.find((l) => l.productName.toLowerCase().includes('urea'));
  const pItem = lineItems.find(
    (l) => l.productName.toLowerCase().includes('dap') || l.productName.toLowerCase().includes('ssp'),
  );
  const mop = lineItems.find((l) => l.productName.toLowerCase().includes('mop'));
  const zinc = lineItems.find((l) => l.productName.toLowerCase().includes('zinc'));

  const normCrop = crop.toLowerCase();

  if (normCrop === 'rice') {
    const basalProducts: Array<{ productName: string; totalKg: number }> = [];
    if (pItem && pItem.totalQuantityKg > 0) basalProducts.push({ productName: pItem.productName, totalKg: pItem.totalQuantityKg });
    if (mop && mop.totalQuantityKg > 0) basalProducts.push({ productName: mop.productName, totalKg: round1(mop.totalQuantityKg * 0.5) });
    if (urea && urea.totalQuantityKg > 0) basalProducts.push({ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.5) });
    if (zinc && zinc.totalQuantityKg > 0) basalProducts.push({ productName: `${zinc.productName} (apply separately)`, totalKg: zinc.totalQuantityKg });

    return [
      {
        stage: 'Basal Application',
        timing: 'At final puddling / transplanting (Day 0)',
        instructions: 'Incorporate full P source, 50% MOP, and 50% remaining Urea evenly before transplanting. Broadcast Zinc Sulphate separately (do not premix with DAP/SSP).',
        products: basalProducts,
      },
      {
        stage: 'First Top Dressing (Active Tillering)',
        timing: '21 – 25 Days After Transplanting',
        instructions: 'Drain standing water to a thin film before broadcasting Neem-Coated Urea; re-irrigate after 24 hours.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.25) }] : [],
      },
      {
        stage: 'Second Top Dressing (Panicle Initiation)',
        timing: '42 – 45 Days After Transplanting',
        instructions: 'Apply final 25% Urea and remaining 50% MOP to support panicle development and grain weight.',
        products: [
          ...(urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.25) }] : []),
          ...(mop && mop.totalQuantityKg > 0 ? [{ productName: mop.productName, totalKg: round1(mop.totalQuantityKg * 0.5) }] : []),
        ],
      },
    ];
  }

  if (normCrop === 'sugarcane') {
    return [
      {
        stage: 'Basal at Planting',
        timing: 'At furrow planting (Week 0)',
        instructions: 'Place full P and K fertilizers plus 10% of remaining Urea in furrows and cover lightly with soil before sett placement.',
        products: [
          ...(pItem && pItem.totalQuantityKg > 0 ? [{ productName: pItem.productName, totalKg: pItem.totalQuantityKg }] : []),
          ...(mop && mop.totalQuantityKg > 0 ? [{ productName: mop.productName, totalKg: mop.totalQuantityKg }] : []),
          ...(urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.1) }] : []),
          ...(zinc && zinc.totalQuantityKg > 0 ? [{ productName: zinc.productName, totalKg: zinc.totalQuantityKg }] : []),
        ],
      },
      {
        stage: 'First Top Dressing',
        timing: '6 Weeks After Planting',
        instructions: 'Side-dress 20% Urea along cane rows followed by light irrigation.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.2) }] : [],
      },
      {
        stage: 'Second Top Dressing',
        timing: '10 Weeks After Planting',
        instructions: 'Apply 30% Urea near root zone during inter-cultivation.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.3) }] : [],
      },
      {
        stage: 'Final Top Dressing & Earthing Up',
        timing: '14 Weeks After Planting',
        instructions: 'Apply remaining 40% Urea and complete final earthing up to prevent lodging.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.4) }] : [],
      },
    ];
  }

  if (normCrop.includes('maize')) {
    return [
      {
        stage: 'Basal Application',
        timing: 'At sowing (Day 0)',
        instructions: 'Band-place 100% P, 100% K, and 33% remaining Urea 5 cm beside and below seed row.',
        products: [
          ...(pItem && pItem.totalQuantityKg > 0 ? [{ productName: pItem.productName, totalKg: pItem.totalQuantityKg }] : []),
          ...(mop && mop.totalQuantityKg > 0 ? [{ productName: mop.productName, totalKg: mop.totalQuantityKg }] : []),
          ...(urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.33) }] : []),
          ...(zinc && zinc.totalQuantityKg > 0 ? [{ productName: zinc.productName, totalKg: zinc.totalQuantityKg }] : []),
        ],
      },
      {
        stage: 'Knee-High Top Dressing',
        timing: '28 – 32 Days After Sowing',
        instructions: 'Side-dress 33% Urea when soil has adequate moisture and follow with earthing up.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.33) }] : [],
      },
      {
        stage: 'Pre-Tasseling Top Dressing',
        timing: '48 – 52 Days After Sowing',
        instructions: 'Apply final 34% Urea just before tasseling for cob fill.',
        products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.34) }] : [],
      },
    ];
  }

  // Wheat default split
  return [
    {
      stage: 'Basal at Sowing',
      timing: 'At sowing (Day 0)',
      instructions: 'Drill full Phosphorus, full Potassium, and 50% remaining Urea below seed zone at sowing.',
      products: [
        ...(pItem && pItem.totalQuantityKg > 0 ? [{ productName: pItem.productName, totalKg: pItem.totalQuantityKg }] : []),
        ...(mop && mop.totalQuantityKg > 0 ? [{ productName: mop.productName, totalKg: mop.totalQuantityKg }] : []),
        ...(urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.5) }] : []),
        ...(zinc && zinc.totalQuantityKg > 0 ? [{ productName: zinc.productName, totalKg: zinc.totalQuantityKg }] : []),
      ],
    },
    {
      stage: 'Crown Root Initiation (CRI) Top Dressing',
      timing: '21 – 25 Days After Sowing',
      instructions: 'Broadcast remaining 50% Urea immediately after first CRI irrigation.',
      products: urea && urea.totalQuantityKg > 0 ? [{ productName: urea.productName, totalKg: round1(urea.totalQuantityKg * 0.5) }] : [],
    },
  ];
}

export function calculateFertilizerRecommendation(
  input: FertilizerCalculationInput,
): Omit<FertilizerRecommendationRecord, 'id' | 'createdAt'> {
  const standard = findValidatedStandard(input.crop, input.district, input.season, input.state);

  // CALCULATION SAFETY RULE (Section 8 & 16):
  // Never invent a fertilizer dose if no validated ICAR/STCR rule matches crop + district/state + season.
  if (!standard) {
    const supportedDistrictsForCrop = CROP_NUTRIENT_STANDARDS.filter(
      (s) => s.crop.toLowerCase() === input.crop.toLowerCase(),
    ).map((s) => `${s.district} (${s.state}, ${s.season})`);

    const missingInformation = [
      `No verified ICAR-IISS (June 2026) or State Agricultural University STCR nutrient standard exists for ${input.crop} in ${input.district}${input.state ? `, ${input.state}` : ''} during ${input.season} season.`,
      supportedDistrictsForCrop.length > 0
        ? `Validated coverage for ${input.crop} currently includes: ${supportedDistrictsForCrop.slice(0, 8).join(', ')}.`
        : `${input.crop} is not part of the five-crop national ICAR Dataset D table (Rice, Wheat, Sugarcane, Kharif Maize, Rabi Maize).`,
    ];

    return {
      soilAnalysisId: input.soilAnalysisId,
      farmId: input.farmId,
      farmName: input.farmName,
      state: input.state,
      district: input.district,
      crop: input.crop,
      season: input.season,
      growthStage: input.growthStage,
      landAreaHectares: input.landAreaHectares,
      landAreaDisplay: input.landAreaDisplay,
      status: 'expert_review_required',
      expertReviewReason:
        'Calculation Safety Guardrail triggered: SoilSense AI refuses to fabricate fertilizer quantities where no validated ICAR or Indian State Agricultural University rule matches the crop, region, and season.',
      missingInformation,
      calculationMethod: 'Safety Hold — Flagged for Agricultural Expert / KVK Review',
      targetsKgPerHa: { N: 0, P2O5: 0, K2O: 0 },
      soilAdjustmentNotes: [
        'Review the verified soil assessment report with your district Krishi Vigyan Kendra (KVK) or State Agricultural University (SAU) agronomist.',
      ],
      lineItems: [],
      totalEstimatedCostInr: 0,
      applicationSchedule: [],
      assumptions: [
        'Deterministic safety rule enforced: only ICAR-validated crop, region, and season matches produce numeric fertilizer doses.',
      ],
      warnings: [
        'Do not apply unverified dosages from generic crop-suitability datasets or ungrounded LLM estimates.',
      ],
      sourceReferences: [
        'ICAR-IISS District-wise General Fertilizer Recommendations (June 2026)',
        'SoilSense AI Calculation Safety Protocol (Section 8)',
      ],
    };
  }

  // Step 1: Soil Health Card fertility-class adjustment (±25% rule per ICAR SHC guidelines)
  const getAssessment = (param: string) =>
    input.assessments.find((a) => a.parameterName === param);

  const nAssess = getAssessment('Nitrogen');
  const pAssess = getAssessment('Phosphorus');
  const kAssess = getAssessment('Potassium');
  const sAssess = getAssessment('Sulphur');
  const znAssess = getAssessment('Zinc');
  const phAssess = getAssessment('pH');
  const ocAssess = getAssessment('OrganicCarbon');

  const adjustTarget = (base: number, status: string | undefined, label: string): { value: number; note: string } => {
    if (status === 'Low' || status === 'Deficient') {
      const adjusted = round1(base * 1.25);
      return {
        value: adjusted,
        note: `${label}: Base ${base} kg/ha adjusted +25% to ${adjusted} kg/ha due to Low soil status (ICAR SHC rule).`,
      };
    }
    if (status === 'High' || status === 'Excess') {
      const adjusted = round1(base * 0.75);
      return {
        value: adjusted,
        note: `${label}: Base ${base} kg/ha reduced -25% to ${adjusted} kg/ha due to High soil reserve (ICAR SHC rule).`,
      };
    }
    return {
      value: base,
      note: `${label}: Maintained at standard ICAR district target (${base} kg/ha) for Medium/Untested soil status.`,
    };
  };

  const nAdj = adjustTarget(standard.nitrogenReqKgHa, nAssess?.status, 'Nitrogen (N)');
  const pAdj = adjustTarget(standard.phosphorusP2O5ReqKgHa, pAssess?.status, 'Phosphorus (P2O5)');
  const kAdj = adjustTarget(standard.potassiumK2OReqKgHa, kAssess?.status, 'Potassium (K2O)');

  const targetN = nAdj.value;
  const targetP2O5 = pAdj.value;
  const targetK2O = kAdj.value;

  const soilAdjustmentNotes = [nAdj.note, pAdj.note, kAdj.note];

  // Step 2: Fetch FCO 1985 product definitions with optional custom prices
  const getProduct = (code: 'UREA' | 'DAP' | 'MOP' | 'SSP' | 'ZNSO4'): FertilizerProductSeed => {
    const base = FERTILIZER_PRODUCTS.find((p) => p.code === code)!;
    const customPrice = input.customPricesPerBagInr?.[code];
    return customPrice && customPrice > 0 ? { ...base, pricePerBagInr: customPrice } : base;
  };

  const ureaProd = getProduct('UREA');
  const dapProd = getProduct('DAP');
  const mopProd = getProduct('MOP');
  const sspProd = getProduct('SSP');
  const znProd = getProduct('ZNSO4');

  // Step 3: Constrained Multi-Nutrient Optimizer (compare DAP vs SSP plan considering Sulphur deficiency & cost)
  const sulphurDeficient = sAssess?.status === 'Deficient';
  const evaluatePlan = (pChoice: 'DAP' | 'SSP') => {
    const items: FertilizerLineItem[] = [];
    let nCreditFromP = 0;

    if (pChoice === 'DAP') {
      const dapKgHa = round1(targetP2O5 / (dapProd.phosphorusP2O5Pct / 100));
      nCreditFromP = round1(dapKgHa * (dapProd.nitrogenPct / 100));
      const totalKg = round1(dapKgHa * input.landAreaHectares);
      const totalBags = round2(totalKg / dapProd.bagWeightKg);
      items.push({
        fertilizerProductId: dapProd.id,
        productName: dapProd.name,
        gradeLabel: '18% N · 46% P2O5',
        quantityPerHectareKg: dapKgHa,
        totalQuantityKg: totalKg,
        bagWeightKg: dapProd.bagWeightKg,
        totalBags,
        pricePerBagInr: dapProd.pricePerBagInr,
        estimatedPriceInr: Math.round(totalBags * dapProd.pricePerBagInr),
        nutrientsContributedKgPerHa: {
          N: nCreditFromP,
          P2O5: targetP2O5,
          K2O: 0,
        },
      });
    } else {
      const sspKgHa = round1(targetP2O5 / (sspProd.phosphorusP2O5Pct / 100));
      const totalKg = round1(sspKgHa * input.landAreaHectares);
      const totalBags = round2(totalKg / sspProd.bagWeightKg);
      items.push({
        fertilizerProductId: sspProd.id,
        productName: sspProd.name,
        gradeLabel: '16% P2O5 · 11% S',
        quantityPerHectareKg: sspKgHa,
        totalQuantityKg: totalKg,
        bagWeightKg: sspProd.bagWeightKg,
        totalBags,
        pricePerBagInr: sspProd.pricePerBagInr,
        estimatedPriceInr: Math.round(totalBags * sspProd.pricePerBagInr),
        nutrientsContributedKgPerHa: {
          N: 0,
          P2O5: targetP2O5,
          K2O: 0,
          S: round1(sspKgHa * 0.11),
        },
      });
    }

    // Account for DAP Nitrogen contribution before calculating Urea!
    const remainingN = Math.max(0, round1(targetN - nCreditFromP));
    const ureaKgHa = round1(remainingN / (ureaProd.nitrogenPct / 100));
    const ureaTotalKg = round1(ureaKgHa * input.landAreaHectares);
    const ureaBags = round2(ureaTotalKg / ureaProd.bagWeightKg);
    items.push({
      fertilizerProductId: ureaProd.id,
      productName: ureaProd.name,
      gradeLabel: '46% N',
      quantityPerHectareKg: ureaKgHa,
      totalQuantityKg: ureaTotalKg,
      bagWeightKg: ureaProd.bagWeightKg,
      totalBags: ureaBags,
      pricePerBagInr: ureaProd.pricePerBagInr,
      estimatedPriceInr: Math.round(ureaBags * ureaProd.pricePerBagInr),
      nutrientsContributedKgPerHa: {
        N: remainingN,
        P2O5: 0,
        K2O: 0,
      },
    });

    // Potash via MOP (60% K2O)
    const mopKgHa = round1(targetK2O / (mopProd.potassiumK2OPct / 100));
    const mopTotalKg = round1(mopKgHa * input.landAreaHectares);
    const mopBags = round2(mopTotalKg / mopProd.bagWeightKg);
    items.push({
      fertilizerProductId: mopProd.id,
      productName: mopProd.name,
      gradeLabel: '60% K2O',
      quantityPerHectareKg: mopKgHa,
      totalQuantityKg: mopTotalKg,
      bagWeightKg: mopProd.bagWeightKg,
      totalBags: mopBags,
      pricePerBagInr: mopProd.pricePerBagInr,
      estimatedPriceInr: Math.round(mopBags * mopProd.pricePerBagInr),
      nutrientsContributedKgPerHa: {
        N: 0,
        P2O5: 0,
        K2O: targetK2O,
      },
    });

    const totalCost = items.reduce((sum, item) => sum + item.estimatedPriceInr, 0);
    return { pChoice, items, nCreditFromP, totalCost };
  };

  const dapPlan = evaluatePlan('DAP');
  const sspPlan = evaluatePlan('SSP');

  let chosen = dapPlan;
  let optimizerRationale = '';

  if (input.preferredPSource === 'SSP') {
    chosen = sspPlan;
    optimizerRationale = 'SSP selected per farmer preference; supplies secondary Sulphur (11% S) alongside P2O5.';
  } else if (input.preferredPSource === 'DAP') {
    chosen = dapPlan;
    optimizerRationale = `DAP selected; its 18% Nitrogen contribution (${dapPlan.nCreditFromP} kg N/ha) was credited and deducted before calculating Urea.`;
  } else {
    // Auto optimize: if Sulphur is deficient choose SSP; otherwise pick lowest-cost valid product mix
    if (sulphurDeficient) {
      chosen = sspPlan;
      optimizerRationale =
        'Optimizer selected SSP + Urea + MOP because soil Sulphur is deficient (< 10 ppm), supplying 11% S alongside P2O5.';
    } else if (dapPlan.totalCost <= sspPlan.totalCost) {
      chosen = dapPlan;
      optimizerRationale = `Optimizer selected lowest-cost DAP + Urea + MOP mix (saves ₹${Math.max(0, sspPlan.totalCost - dapPlan.totalCost).toLocaleString('en-IN')} vs SSP mix) and credited ${dapPlan.nCreditFromP} kg N/ha from DAP before computing Urea.`;
    } else {
      chosen = sspPlan;
      optimizerRationale = `Optimizer selected lowest-cost SSP + Urea + MOP mix (saves ₹${Math.max(0, dapPlan.totalCost - sspPlan.totalCost).toLocaleString('en-IN')} vs DAP mix).`;
    }
  }

  const lineItems = [...chosen.items];

  // Optional Zinc Sulphate correction when DTPA Zinc is Deficient (< 0.60 ppm)
  const shouldIncludeZinc = (input.includeZincIfDeficient ?? true) && znAssess?.status === 'Deficient';
  if (shouldIncludeZinc) {
    const znKgHa = 20; // Standard ICAR basal corrective dose for Zn-deficient Indian soils
    const znTotalKg = round1(znKgHa * input.landAreaHectares);
    const znBags = round2(znTotalKg / znProd.bagWeightKg);
    lineItems.push({
      fertilizerProductId: znProd.id,
      productName: znProd.name,
      gradeLabel: '21% Zn · 10.5% S',
      quantityPerHectareKg: znKgHa,
      totalQuantityKg: znTotalKg,
      bagWeightKg: znProd.bagWeightKg,
      totalBags: znBags,
      pricePerBagInr: znProd.pricePerBagInr,
      estimatedPriceInr: Math.round(znBags * znProd.pricePerBagInr),
      nutrientsContributedKgPerHa: {
        N: 0,
        P2O5: 0,
        K2O: 0,
        Zn: round1(znKgHa * 0.21),
        S: round1(znKgHa * 0.105),
      },
    });
  }

  const totalEstimatedCostInr = lineItems.reduce((sum, item) => sum + item.estimatedPriceInr, 0);
  const applicationSchedule = buildSplitSchedule(input.crop, lineItems);

  const warnings: string[] = [];
  if (shouldIncludeZinc) {
    warnings.push(
      'Compatibility warning: Never physically premix Zinc Sulphate with DAP or SSP — apply them separately to prevent insoluble zinc-phosphate formation.',
    );
  }
  if (phAssess?.status === 'Acidic') {
    warnings.push(
      `Soil pH is acidic (${phAssess.measuredValue}). Consult local KVK for agricultural lime requirement 2–3 weeks before basal fertilization.`,
    );
  }
  if (phAssess?.status === 'Alkaline') {
    warnings.push(
      `Soil pH is alkaline (${phAssess.measuredValue}). Avoid broadcasting Urea on dry surface soil; incorporate lightly and consider organic manure to improve micronutrient uptake.`,
    );
  }
  if (ocAssess?.status === 'Deficient') {
    warnings.push(
      'Low Organic Carbon (< 0.50%): Supplement chemical fertilizers with 5–10 t/ha well-decomposed FYM or green leaf manure to improve nutrient use efficiency.',
    );
  }

  const matchScope =
    standard.state === 'All-India General'
      ? `All-India ICAR-IISS national baseline applied for ${input.district}${input.state ? `, ${input.state}` : ''}.`
      : standard.district.toLowerCase() === input.district.toLowerCase()
        ? `Matched district-level ICAR/SAU standard (${standard.district}, ${standard.state}).`
        : `Matched state-level ICAR/SAU reference (${standard.state} — ${standard.district} zone).`;

  const assumptions = [
    optimizerRationale,
    matchScope,
    `Nutrient oxide forms strictly preserved: N as elemental N, P as P2O5, K as K2O (per ICAR-IISS & FCO 1985).`,
    `Farm area scaled cleanly using ${input.landAreaDisplay} = ${input.landAreaHectares} hectares.`,
    `Indicative Indian statutory/MRP bag rates used for cost estimation; verify current local KVK / cooperative / dealer rates before purchase.`,
  ];

  return {
    soilAnalysisId: input.soilAnalysisId,
    farmId: input.farmId,
    farmName: input.farmName,
    state: input.state,
    district: input.district,
    crop: input.crop,
    season: input.season,
    growthStage: input.growthStage,
    landAreaHectares: input.landAreaHectares,
    landAreaDisplay: input.landAreaDisplay,
    status: 'calculated',
    calculationMethod: `Deterministic ICAR-IISS + SHC Fertility Adjustment + FCO 1985 Multi-Nutrient Optimizer (${chosen.pChoice}-based)`,
    targetYieldNote: standard.targetYield,
    targetsKgPerHa: {
      N: targetN,
      P2O5: targetP2O5,
      K2O: targetK2O,
    },
    soilAdjustmentNotes,
    lineItems,
    totalEstimatedCostInr,
    applicationSchedule,
    assumptions,
    warnings,
    sourceReferences: [
      standard.sourceReference,
      'Fertiliser Control Order, 1985 (Schedule I Verified Nutrient Grades)',
      'ICAR Soil Health Card Fertility-Class Adjustment Guidelines',
    ],
  };
}
