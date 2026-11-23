import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChatSourceCitation,
  FertilizerRecommendationRecord,
  SoilAnalysisRecord,
  SoilMeasurementInput,
  SupportedLanguage,
} from '../../shared/types.js';
import { retrieveKnowledgeBase } from '../data/knowledgeBase.js';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  kn: 'Kannada (ಕನ್ನಡ)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  hi: 'Hindi (हिन्दी)',
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ExtractedSoilReportResult {
  labName: string;
  sampleDate: string;
  sampleDepth: string;
  extractionMethod: string;
  confidenceNotes: string;
  measurements: SoilMeasurementInput[];
}

export async function extractSoilReportWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractedSoilReportResult> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Set GEMINI_API_KEY in Secrets / Environment Variables to enable PDF and image soil report extraction.',
    );
  }

  const base64Data = fileBuffer.toString('base64');

  const promptText = [
    'You are an agronomic laboratory data extractor for Indian Soil Health Cards and soil lab reports.',
    `Source filename: ${fileName}.`,
    'Extract all available soil test measurements accurately. CRITICAL RULES:',
    '1. NEVER invent or guess missing measurements — omit parameters not present in the document or set measuredValue to null.',
    '2. Preserve the EXACT numeric value and unit printed on the lab report (e.g. "kg/ha", "mg/kg", "ppm", "dS/m", "%", "pH"). Do NOT silently convert mg/kg into kg/ha.',
    '3. Map parameter names strictly to: pH, Nitrogen, Phosphorus, Potassium, EC, OrganicCarbon, Sulphur, Zinc, Iron, Boron, Copper, Manganese, Moisture.',
    '4. Record lab name, sample date (YYYY-MM-DD if visible), sampling depth (e.g. "0-15 cm"), and extraction method notes if present.',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: promptText },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          labName: { type: Type.STRING, description: 'Laboratory or Soil Health Card issuing authority name' },
          sampleDate: { type: Type.STRING, description: 'Sample date in YYYY-MM-DD format if found, else empty string' },
          sampleDepth: { type: Type.STRING, description: 'Sampling depth e.g. 0-15 cm' },
          extractionMethod: { type: Type.STRING, description: 'Lab extraction methods noted on report' },
          confidenceNotes: { type: Type.STRING, description: 'Any legibility warnings or unit notes for farmer verification' },
          measurements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                parameterName: { type: Type.STRING },
                measuredValue: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                method: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Partial<ExtractedSoilReportResult>;

  const validKeys = new Set([
    'pH', 'Nitrogen', 'Phosphorus', 'Potassium', 'EC', 'OrganicCarbon',
    'Sulphur', 'Zinc', 'Iron', 'Boron', 'Copper', 'Manganese', 'Moisture',
  ]);

  const cleanedMeasurements: SoilMeasurementInput[] = (parsed.measurements ?? [])
    .filter((m) => m && validKeys.has(m.parameterName) && typeof m.measuredValue === 'number' && Number.isFinite(m.measuredValue))
    .map((m) => ({
      parameterName: m.parameterName as SoilMeasurementInput['parameterName'],
      measuredValue: m.measuredValue,
      unit: m.unit || 'kg/ha',
      method: m.method || 'Lab reported',
    }));

  return {
    labName: parsed.labName || 'Uploaded Soil Health Report',
    sampleDate: parsed.sampleDate || new Date().toISOString().slice(0, 10),
    sampleDepth: parsed.sampleDepth || '0–15 cm',
    extractionMethod: parsed.extractionMethod || 'Document OCR Extraction (Gemini Multimodal)',
    confidenceNotes:
      parsed.confidenceNotes ||
      'Review every extracted value and unit carefully against your printed soil card before saving.',
    measurements: cleanedMeasurements,
  };
}

async function callNvidiaFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured for fallback.');
  }
  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NVIDIA API error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('NVIDIA API returned an empty response.');
  }
  return content;
}

export interface AssistantReplyPayload {
  answer: string;
  provider: 'gemini' | 'nvidia';
  sourceReferences: ChatSourceCitation[];
}

export async function generateGroundedAgronomicAnswer(params: {
  question: string;
  language: SupportedLanguage;
  farmContext?: {
    farmName: string;
    state?: string;
    district: string;
    village: string;
    crop: string;
    season: string;
    areaDisplay: string;
  } | null;
  latestAnalysis?: SoilAnalysisRecord | null;
  latestRecommendation?: FertilizerRecommendationRecord | null;
  history?: Array<{ question: string; answer: string }>;
}): Promise<AssistantReplyPayload> {
  const contextKeywords: string[] = [];
  if (params.farmContext) {
    contextKeywords.push(
      params.farmContext.state ?? '',
      params.farmContext.district,
      params.farmContext.crop,
      params.farmContext.season,
    );
  }
  if (params.latestAnalysis) {
    for (const a of params.latestAnalysis.assessments) {
      if (a.status === 'Deficient' || a.status === 'Low' || a.status === 'Acidic' || a.status === 'Alkaline') {
        contextKeywords.push(a.parameterName, a.status);
      }
    }
  }

  const retrievedSources = retrieveKnowledgeBase(params.question, contextKeywords, 3);
  const targetLanguageName = LANGUAGE_LABELS[params.language] || 'English';

  const systemInstruction = [
    'You are SoilSense AI, a farmer-friendly agricultural extension assistant serving farmers across all states and union territories of India.',
    `Respond clearly and warmly in ${targetLanguageName}. Use simple, practical farming terms suitable for an Indian farmer while keeping scientific accuracy.`,
    'STRICT AGRONOMIC SAFETY RULES:',
    '1. NEVER invent, guess, or independently calculate new fertilizer quantities (kg/ha or bags). ONLY reference and explain the verified deterministic fertilizer numbers provided in the Farm & Recommendation Context below.',
    '2. If the recommendation status is "expert_review_required" or no validated recommendation exists, clearly tell the farmer that no verified ICAR dose is available for that crop/season and advise consulting their local Krishi Vigyan Kendra (KVK) or State Agricultural University agronomist.',
    '3. Ground your explanation strictly in the Retrieved Agricultural Reference Sources provided below and cite the source titles naturally in your answer.',
    '4. Keep responses concise (3–6 short paragraphs or clear bullet points), practical, and focused on soil health, nutrient deficiencies, and safe application timing.',
  ].join('\n');

  const contextBlocks: string[] = [];
  if (params.farmContext) {
    contextBlocks.push(
      `ACTIVE FARM: ${params.farmContext.farmName} (${params.farmContext.village}, ${params.farmContext.district}, ${params.farmContext.state || 'India'}) | Area: ${params.farmContext.areaDisplay} | Crop: ${params.farmContext.crop} (${params.farmContext.season})`,
    );
  }
  if (params.latestAnalysis) {
    const tested = params.latestAnalysis.assessments
      .filter((a) => a.status !== 'Missing')
      .map((a) => `${a.label}: ${a.measuredValue} ${a.unit} [${a.status}]`)
      .join('; ');
    contextBlocks.push(
      `VERIFIED SOIL ANALYSIS (${params.latestAnalysis.sampleDate}, Lab: ${params.latestAnalysis.labName}): ${tested}. Summary: ${params.latestAnalysis.overallHealthSummary}`,
    );
  }
  if (params.latestRecommendation) {
    if (params.latestRecommendation.status === 'expert_review_required') {
      contextBlocks.push(
        `FERTILIZER RECOMMENDATION STATUS: EXPERT REVIEW REQUIRED. Reason: ${params.latestRecommendation.expertReviewReason}`,
      );
    } else {
      const lines = params.latestRecommendation.lineItems
        .map(
          (l) =>
            `${l.productName} (${l.gradeLabel}): ${l.quantityPerHectareKg} kg/ha -> ${l.totalQuantityKg} kg total (${l.totalBags} bags, approx Rs ${l.estimatedPriceInr})`,
        )
        .join(' | ');
      contextBlocks.push(
        `DETERMINISTIC FERTILIZER PLAN (${params.latestRecommendation.calculationMethod}): Targets N=${params.latestRecommendation.targetsKgPerHa.N}, P2O5=${params.latestRecommendation.targetsKgPerHa.P2O5}, K2O=${params.latestRecommendation.targetsKgPerHa.K2O} kg/ha. Products: ${lines}. Total est cost: Rs ${params.latestRecommendation.totalEstimatedCostInr}. Warnings: ${params.latestRecommendation.warnings.join(' ')}`,
      );
    }
  }

  const kbBlock = retrievedSources
    .map((s, idx) => `[Source ${idx + 1}: ${s.title} — ${s.organization}]\n${s.excerpt}`)
    .join('\n\n');

  const recentHistory = (params.history ?? [])
    .slice(-3)
    .map((h) => `Farmer: ${h.question}\nSoilSense AI: ${h.answer}`)
    .join('\n---\n');

  const userPrompt = [
    '=== FARMER CONTEXT ===',
    contextBlocks.length > 0 ? contextBlocks.join('\n') : 'No farm or soil analysis linked yet.',
    '',
    '=== RETRIEVED AGRICULTURAL SOURCES ===',
    kbBlock,
    '',
    recentHistory ? `=== RECENT CONVERSATION ===\n${recentHistory}\n` : '',
    `=== FARMER QUESTION (Answer in ${targetLanguageName}) ===`,
    params.question,
  ].join('\n');

  // Primary provider: Gemini 4 Hydrogen (@google/genai)
  const ai = getGeminiClient();
  let geminiError: string | null = null;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
        },
      });
      const text = response.text?.trim();
      if (text) {
        return {
          answer: text,
          provider: 'gemini',
          sourceReferences: retrievedSources,
        };
      }
      geminiError = 'Gemini returned an empty response.';
    } catch (err) {
      geminiError = err instanceof Error ? err.message : String(err);
      console.warn('Primary Gemini call failed, evaluating fallback:', geminiError);
    }
  } else {
    geminiError = 'GEMINI_API_KEY is not configured in server environment variables.';
  }

  // Optional secondary provider fallback: NVIDIA NIM (when NVIDIA_API_KEY is set)
  if (process.env.NVIDIA_API_KEY) {
    try {
      const nvidiaText = await callNvidiaFallback(systemInstruction, userPrompt);
      return {
        answer: nvidiaText,
        provider: 'nvidia',
        sourceReferences: retrievedSources,
      };
    } catch (nvErr) {
      const nvMsg = nvErr instanceof Error ? nvErr.message : String(nvErr);
      throw new Error(`Both Gemini (${geminiError}) and NVIDIA fallback (${nvMsg}) failed.`);
    }
  }

  throw new Error(
    `AI explanation service unavailable: ${geminiError} Please configure GEMINI_API_KEY in Settings > Secrets (or Vercel/Render Environment Variables).`,
  );
}
