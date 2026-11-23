import type { ChatSourceCitation } from '../../shared/types.js';

export interface KnowledgeDocument {
  id: string;
  title: string;
  organization: string;
  category: 'ICAR' | 'FCO_1985' | 'INDIAN_SAU' | 'SHC_PROTOCOL';
  keywords: string[];
  content: string;
  referenceUrl: string;
}

export const KNOWLEDGE_BASE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'kb_icar_shc_thresholds',
    title: 'ICAR Soil Health Card National Nutrient Rating Thresholds',
    organization: 'ICAR — Ministry of Agriculture & Farmers Welfare (All-India)',
    category: 'SHC_PROTOCOL',
    keywords: [
      'ph', 'nitrogen', 'phosphorus', 'potassium', 'organic carbon', 'ec', 'salinity',
      'zinc', 'iron', 'boron', 'copper', 'manganese', 'sulphur', 'threshold', 'deficient',
      'low', 'medium', 'high', 'soil health card',
    ],
    content:
      'Under the national Soil Health Card (SHC) protocol across India, Available Nitrogen (kg/ha) is rated Low below 280, Medium 280–560, and High above 560. Available Phosphorus (kg/ha as P) is Low below 10, Medium 10–25, and High above 25. Available Potassium (kg/ha as K) is Low below 108, Medium 108–280, and High above 280. Organic Carbon (%) is Low below 0.50%, Medium 0.50–0.75%, and High above 0.75%. Neutral soil pH lies between 6.5 and 7.5; values below 6.5 are acidic (may require agricultural lime) and values above 7.5 are alkaline (above 8.5 strongly alkaline/sodic). Electrical Conductivity (EC) below 1.0 dS/m is normal for most crops. Critical DTPA/extractable micronutrient limits: Zinc 0.60 ppm, Iron 4.5 ppm, Copper 0.20 ppm, Manganese 2.0 ppm, Boron 0.50 ppm, and Sulphur 10.0 ppm.',
    referenceUrl: 'https://soilhealth.dac.gov.in/',
  },
  {
    id: 'kb_icar_gfr_2026',
    title: 'ICAR District-wise General Fertilizer Recommendations for Major Crops in India (June 2026)',
    organization: 'ICAR — Indian Institute of Soil Science (IISS), Bhopal',
    category: 'ICAR',
    keywords: [
      'rice', 'paddy', 'wheat', 'sugarcane', 'maize', 'kharif', 'rabi', 'stcr',
      'recommendation', 'target yield', 'india', 'nitrogen', 'p2o5', 'k2o', 'dose',
    ],
    content:
      'ICAR-IISS national and district-wise recommendations combine Soil Test Crop Response (STCR) targeted-yield frameworks with Soil Health Card fertility classes across all Indian agro-climatic zones. When soil available N, P, or K falls in the Low category, the base recommended dose is adjusted upward by 25%; when in the High category, the dose is reduced by 25% to avoid crop lodging, groundwater leaching, and excess cost. Recommendations are issued only when crop and season match verified ICAR tables; unsupported crops must be flagged for local KVK or State Agricultural University expert review.',
    referenceUrl: 'https://www.icar-ciah.org/include/pdf/advisory/2026/jun_2026/GFR_district_wise_03062026.pdf',
  },
  {
    id: 'kb_fco_1985_grades',
    title: 'Fertiliser Control Order (1985) — Nutrient Grades & Multi-Nutrient Accounting',
    organization: 'Government of India — Department of Agriculture & Farmers Welfare',
    category: 'FCO_1985',
    keywords: [
      'urea', 'dap', 'mop', 'ssp', 'zinc sulphate', 'grade', 'fco', '46%', '18%', '60%',
      'bag', 'multi-nutrient', 'nitrogen credit', 'cost', 'product',
    ],
    content:
      'Under the Fertiliser Control Order (FCO), 1985 Schedule I (applicable across all Indian States & UTs), Neem-Coated Urea contains 46% Nitrogen (N) in 45 kg bags; Di-Ammonium Phosphate (DAP) contains 18% N and 46% P2O5 in 50 kg bags; Muriate of Potash (MOP) contains 60% K2O in 50 kg bags; Single Super Phosphate (SSP) contains 16% P2O5 plus 11% Sulphur in 50 kg bags; and Zinc Sulphate Heptahydrate contains 21% Zinc and 10.5% Sulphur. Whenever DAP is used to meet P2O5 requirements, its 18% Nitrogen contribution MUST be credited and subtracted from crop target N before calculating Urea quantity.',
    referenceUrl: 'https://indiacode.ecourtsindia.com/rules/the-fertiliser-control-order-1985-0781297f/',
  },
  {
    id: 'kb_igp_rice_wheat',
    title: 'Indo-Gangetic Plains Rice-Wheat Nutrient & Split Management (Punjab, Haryana, UP, Bihar, WB)',
    organization: 'ICAR-IIWBR Karnal, PAU Ludhiana & IARI New Delhi',
    category: 'INDIAN_SAU',
    keywords: [
      'punjab', 'haryana', 'uttar pradesh', 'bihar', 'west bengal', 'ludhiana', 'karnal',
      'bareilly', 'meerut', 'patna', 'bardhaman', 'wheat', 'rice', 'paddy', 'cri', 'tillering',
      'urea', 'zinc', 'organic carbon', 'alluvial',
    ],
    content:
      'Across Indo-Gangetic alluvial soils (Punjab, Haryana, UP, Bihar, West Bengal), intensive Rice-Wheat systems frequently exhibit low Organic Carbon (<0.50%) and Zinc deficiency (<0.60 ppm). For Rabi Wheat, apply 50% N along with full P2O5 and K2O at sowing and top-dress the remaining 50% N after the first irrigation at Crown Root Initiation (CRI, 21–25 DAS). For Kharif Rice, split Nitrogen into three doses (basal, active tillering 21–25 DAT, panicle initiation 42–45 DAT) using Neem-Coated Urea, incorporate crop residues or green manure (Dhaincha) to rebuild soil organic carbon, and apply Zinc Sulphate separately from phosphatic fertilizers.',
    referenceUrl: 'https://iiwbr.icar.gov.in/',
  },
  {
    id: 'kb_deccan_south_peninsula',
    title: 'Peninsular Black Vertisols & Southern Irrigated Delta Management (MH, KA, TN, AP, TS, MP)',
    organization: 'ICAR-IISS Bhopal, UAS Bengaluru, TNAU Coimbatore & MPKV Rahuri',
    category: 'INDIAN_SAU',
    keywords: [
      'maharashtra', 'karnataka', 'tamil nadu', 'andhra pradesh', 'telangana', 'madhya pradesh',
      'mandya', 'belagavi', 'dharwad', 'kolhapur', 'thanjavur', 'guntur', 'indore', 'nizamabad',
      'sugarcane', 'maize', 'rice', 'vertisol', 'black soil', 'alkaline', 'iron', 'chlorosis', 'sulphur',
    ],
    content:
      'In Deccan Plateau black Vertisols (Maharashtra, Madhya Pradesh, Northern Karnataka, Telangana, Andhra Pradesh) and Southern alluvial deltas (Cauvery, Krishna-Godavari), soils are often high in Potassium and moderately alkaline (pH 7.8–8.4), which locks up DTPA Zinc and Iron. Prefer Single Super Phosphate (SSP, 11% S) when soil Sulphur is below 10 ppm, apply gypsum for sodic patches, and use foliar 0.5% Ferrous Sulphate or Zinc Sulphate if chlorosis appears. For Sugarcane, apply full P and K at planting and split Nitrogen across planting (10%), 6 weeks (20%), 10 weeks (30%), and 14 weeks earthing-up (40%).',
    referenceUrl: 'https://iiss.icar.gov.in/',
  },
  {
    id: 'kb_acidic_east_northeast_arid_west',
    title: 'Managing Acidic Soils (East, Northeast, Kerala, Hills) & Arid Alkaline Soils (Rajasthan, Gujarat)',
    organization: 'ICAR National Bureau of Soil Survey & Land Use Planning (NBSS&LUP)',
    category: 'INDIAN_SAU',
    keywords: [
      'assam', 'odisha', 'jharkhand', 'kerala', 'meghalaya', 'himachal', 'hassan', 'palakkad',
      'jorhat', 'cuttack', 'ranchi', 'rajasthan', 'gujarat', 'jaipur', 'ganganagar', 'anand',
      'acidic', 'lime', 'boron', 'arid', 'saline', 'gypsum', 'ph', 'ec',
    ],
    content:
      'Strongly acidic soils (pH < 6.0) across Assam, Meghalaya, Odisha, Jharkhand, Kerala, Himachal Pradesh, and Western Ghats fix applied phosphorus and commonly show Boron deficiency (<0.50 ppm); apply agricultural lime based on soil lime-requirement tests 2–3 weeks before sowing alongside 5–10 t/ha FYM/compost. In arid and semi-arid soils of Rajasthan and Gujarat (low OC <0.40%, alkaline pH >8.0, elevated EC), avoid broadcasting Urea on hot dry soils, incorporate organic manures, ensure drainage leaching if EC >2.0 dS/m, and time top-dressings around irrigation.',
    referenceUrl: 'https://nbsslup.icar.gov.in/',
  },
];

export function retrieveKnowledgeBase(query: string, contextKeywords: string[] = [], topK = 3): ChatSourceCitation[] {
  const combinedText = `${query} ${contextKeywords.join(' ')}`.toLowerCase();
  const tokens = combinedText
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const scored = KNOWLEDGE_BASE_DOCUMENTS.map((doc) => {
    let score = 0;
    const haystack = `${doc.title} ${doc.content}`.toLowerCase();
    for (const kw of doc.keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        score += 4;
      }
    }
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += 1;
      }
    }
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ doc }) => ({
    id: doc.id,
    title: doc.title,
    organization: doc.organization,
    category: doc.category,
    excerpt: doc.content,
    referenceUrl: doc.referenceUrl,
  }));
}
