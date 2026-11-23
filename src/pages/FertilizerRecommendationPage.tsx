import React, { useState } from 'react';
import { AlertTriangle, Calculator, Compass, FileDown, MessageSquare, ShieldAlert } from 'lucide-react';
import type { CropSeason, CropSuitabilityResult, GrowthStage } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const SEASONS: CropSeason[] = ['Kharif', 'Rabi', 'Summer', 'Annual'];
const STAGES: GrowthStage[] = [
  'Pre-sowing / Basal',
  'Vegetative / Tillering',
  'Flowering / Panicle',
  'Grain Filling / Maturity',
];

export function FertilizerRecommendationPage() {
  const {
    analyses,
    selectedAnalysisId,
    recommendations,
    selectedRecommendationId,
    setSelectedRecommendationId,
    crops,
    refreshWorkspaceData,
    setPage,
    notify,
  } = useApp();

  const defaultAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) ?? analyses[0] ?? null;

  const [analysisId, setAnalysisId] = useState<string>(defaultAnalysis?.id ?? '');
  const [crop, setCrop] = useState<string>(defaultAnalysis?.crop ?? 'Rice');
  const [season, setSeason] = useState<CropSeason>('Kharif');
  const [growthStage, setGrowthStage] = useState<GrowthStage>('Pre-sowing / Basal');
  const [preferredPSource, setPreferredPSource] = useState<'auto' | 'DAP' | 'SSP'>('auto');
  const [includeZinc, setIncludeZinc] = useState<boolean>(true);
  const [calculating, setCalculating] = useState(false);

  // Optional Module 5: Exploratory Crop Suitability
  const [suitabilityOpen, setSuitabilityOpen] = useState(false);
  const [tempC, setTempC] = useState('27');
  const [humidityPct, setHumidityPct] = useState('72');
  const [rainfallMm, setRainfallMm] = useState('145');
  const [suitabilityResults, setSuitabilityResults] = useState<CropSuitabilityResult[] | null>(null);
  const [suitabilityLoading, setSuitabilityLoading] = useState(false);

  const activeRec =
    recommendations.find((r) => r.id === selectedRecommendationId) ?? recommendations[0] ?? null;

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAnalysisId = analysisId || defaultAnalysis?.id;
    if (!targetAnalysisId) {
      notify('error', 'Submit a verified soil analysis before calculating a fertilizer plan.');
      return;
    }
    setCalculating(true);
    try {
      const res = await api.generateFertilizer({
        soilAnalysisId: targetAnalysisId,
        crop,
        season,
        growthStage,
        preferredPSource,
        includeZincIfDeficient: includeZinc,
      });
      await refreshWorkspaceData();
      setSelectedRecommendationId(res.recommendation.id);
      if (res.recommendation.status === 'expert_review_required') {
        notify('info', 'No validated ICAR rule matched — flagged for agricultural expert review.');
      } else {
        notify('success', 'Deterministic ICAR + FCO 1985 fertilizer schedule calculated.');
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeRec) return;
    try {
      const res = await api.generateReport({
        soilAnalysisId: activeRec.soilAnalysisId,
        recommendationId: activeRec.id,
      });
      await refreshWorkspaceData();
      const url = api.getReportDownloadUrl(res.report.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify('success', 'Advisory PDF report generated.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Could not export PDF.');
    }
  };

  const handleRunSuitability = async () => {
    const src = analyses.find((a) => a.id === (analysisId || defaultAnalysis?.id));
    if (!src) return;
    const getVal = (k: string, fallback: number) =>
      src.assessments.find((a) => a.parameterName === k)?.normalizedValue ??
      src.assessments.find((a) => a.parameterName === k)?.measuredValue ??
      fallback;

    setSuitabilityLoading(true);
    try {
      const res = await api.evaluateCropSuitability({
        nitrogenKgHa: getVal('Nitrogen', 230),
        phosphorusKgHa: getVal('Phosphorus', 16),
        potassiumKgHa: getVal('Potassium', 250),
        ph: getVal('pH', 7.0),
        temperatureC: Number(tempC) || 27,
        humidityPct: Number(humidityPct) || 70,
        rainfallMm: Number(rainfallMm) || 120,
      });
      setSuitabilityResults(res.recommendations);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Suitability evaluation failed.');
    } finally {
      setSuitabilityLoading(false);
    }
  };

  if (analyses.length === 0) {
    return (
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-10 text-center">
        <Calculator className="w-8 h-8 text-[#1E4631] mx-auto mb-3" />
        <h2 className="font-display text-2xl font-semibold text-[#18231C] mb-2">
          Verified Soil Test Required
        </h2>
        <p className="text-sm text-[#556159] mb-5 max-w-md mx-auto">
          The Fertilizer Calculation Engine requires a verified soil analysis to apply ICAR fertility-class
          adjustments and FCO 1985 product optimization.
        </p>
        <button
          type="button"
          onClick={() => setPage('soil-analysis')}
          className="h-10 px-5 rounded-lg bg-[#1E4631] text-white text-sm font-semibold"
        >
          Enter Soil Test Values
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deterministic Calculation Form */}
      <form
        onSubmit={handleCalculate}
        className="bg-white border border-[#E2DDD3] rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EFECE6]">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18231C]">
              Deterministic ICAR &amp; FCO 1985 Fertilizer Optimizer
            </h2>
            <p className="text-xs text-[#556159]">
              Calculates exact N, P2O5, and K2O targets, credits multi-nutrient DAP nitrogen, and scales to
              your farm area. Unsupported crops trigger an automatic Expert Review hold.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
              Verified Soil Analysis
            </label>
            <select
              value={analysisId || defaultAnalysis?.id || ''}
              onChange={(e) => {
                setAnalysisId(e.target.value);
                const found = analyses.find((a) => a.id === e.target.value);
                if (found) setCrop(found.crop);
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.farmName} ({a.district}{a.state ? `, ${a.state}` : ''}) — {a.sampleDate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Crop</label>
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            >
              {crops.map((c) => (
                <option key={c.id} value={c.cropName}>
                  {c.cropName} {c.icarSupported ? '✓' : '(Expert Review)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as CropSeason)}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Growth Stage</label>
            <select
              value={growthStage}
              onChange={(e) => setGrowthStage(e.target.value as GrowthStage)}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            >
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <label className="flex items-center gap-2 text-[#18231C]">
              <span className="font-semibold">Phosphorus Source:</span>
              <select
                value={preferredPSource}
                onChange={(e) => setPreferredPSource(e.target.value as 'auto' | 'DAP' | 'SSP')}
                className="h-9 px-2.5 rounded-md border border-[#D4CEC2] bg-[#F8F7F4] text-xs"
              >
                <option value="auto">Auto Optimize (Cost &amp; Sulphur)</option>
                <option value="DAP">DAP (18-46-0)</option>
                <option value="SSP">SSP (0-16-0 + 11% S)</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#18231C]">
              <input
                type="checkbox"
                checked={includeZinc}
                onChange={(e) => setIncludeZinc(e.target.checked)}
                className="w-4 h-4 accent-[#1E4631]"
              />
              Include Zinc Sulphate if DTPA Zn &lt; 0.60 ppm
            </label>
          </div>

          <button
            type="submit"
            disabled={calculating}
            className="h-10 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {calculating ? 'Calculating Plan...' : 'Generate Fertilizer Plan'}
          </button>
        </div>
      </form>

      {/* Active Recommendation Result */}
      {activeRec && (
        <div className="space-y-6">
          {activeRec.status === 'expert_review_required' ? (
            <div className="bg-[#FEF2F2] border border-[#B91C1C]/35 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-[#B91C1C] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-xl font-semibold text-[#991B1B]">
                    Agricultural Expert Review Required — No Dose Invented
                  </h3>
                  <p className="text-sm text-[#7F1D1D] mt-1 leading-relaxed">
                    {activeRec.expertReviewReason}
                  </p>
                </div>
              </div>
              {activeRec.missingInformation && (
                <ul className="space-y-1.5 text-sm text-[#7F1D1D] pl-9 list-disc">
                  {activeRec.missingInformation.map((info) => (
                    <li key={info}>{info}</li>
                  ))}
                </ul>
              )}
              <div className="pt-2 pl-9 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setPage('soil-results')}
                  className="h-9 px-4 rounded-lg bg-white border border-[#B91C1C]/30 text-xs font-semibold text-[#991B1B]"
                >
                  Review Soil Assessment
                </button>
                <button
                  type="button"
                  onClick={() => setPage('assistant')}
                  className="h-9 px-4 rounded-lg bg-[#1E4631] text-white text-xs font-semibold"
                >
                  Ask AI Assistant for Guidance
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Target Summary & Export Controls */}
              <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#EFECE6]">
                  <div>
                    <p className="text-xs text-[#556159]">
                      {activeRec.farmName} · {activeRec.district}{activeRec.state ? `, ${activeRec.state}` : ''} ·{' '}
                      {activeRec.crop} ({activeRec.season}) · {activeRec.landAreaDisplay} ({activeRec.landAreaHectares} ha)
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-[#18231C] mt-0.5">
                      Verified Fertilizer Schedule
                    </h3>
                    <p className="text-xs text-[#556159] mt-1">{activeRec.calculationMethod}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPage('assistant')}
                      className="h-10 px-4 rounded-lg border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-xs font-semibold text-[#18231C] inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Explain Plan
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Download PDF Report
                    </button>
                  </div>
                </div>

                {/* Target N, P2O5, K2O & Total Cost Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b border-[#EFECE6]">
                  <div>
                    <p className="text-xs text-[#556159]">Target Nitrogen (N)</p>
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-1">
                      {activeRec.targetsKgPerHa.N} kg/ha
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#556159]">Target Phosphorus (P2O5)</p>
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-1">
                      {activeRec.targetsKgPerHa.P2O5} kg/ha
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#556159]">Target Potassium (K2O)</p>
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-1">
                      {activeRec.targetsKgPerHa.K2O} kg/ha
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#556159]">Estimated Farm Cost</p>
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#1E4631] mt-1">
                      ₹{activeRec.totalEstimatedCostInr.toLocaleString('en-IN')}
                    </p>
                    {activeRec.targetYieldNote && (
                      <p className="text-[11px] text-[#556159]">Target yield: {activeRec.targetYieldNote}</p>
                    )}
                  </div>
                </div>

                {/* Product Quantities Table */}
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2DDD3] text-left text-xs text-[#556159]">
                        <th className="pb-2.5 pr-4 font-medium">FCO Product &amp; Grade</th>
                        <th className="pb-2.5 px-3 font-medium text-right">Per Hectare</th>
                        <th className="pb-2.5 px-3 font-medium text-right">Farm Total ({activeRec.landAreaDisplay})</th>
                        <th className="pb-2.5 px-3 font-medium text-right">Commercial Bags</th>
                        <th className="pb-2.5 px-3 font-medium text-right">Nutrients Supplied (kg/ha)</th>
                        <th className="pb-2.5 pl-3 font-medium text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {activeRec.lineItems.map((item) => {
                        const contribs: string[] = [];
                        if (item.nutrientsContributedKgPerHa.N > 0) contribs.push(`${item.nutrientsContributedKgPerHa.N} N`);
                        if (item.nutrientsContributedKgPerHa.P2O5 > 0) contribs.push(`${item.nutrientsContributedKgPerHa.P2O5} P2O5`);
                        if (item.nutrientsContributedKgPerHa.K2O > 0) contribs.push(`${item.nutrientsContributedKgPerHa.K2O} K2O`);
                        if (item.nutrientsContributedKgPerHa.Zn) contribs.push(`${item.nutrientsContributedKgPerHa.Zn} Zn`);
                        if (item.nutrientsContributedKgPerHa.S) contribs.push(`${item.nutrientsContributedKgPerHa.S} S`);

                        return (
                          <tr key={item.productName}>
                            <td className="py-3.5 pr-4">
                              <p className="font-semibold text-[#18231C]">{item.productName}</p>
                              <p className="text-xs text-[#556159]">{item.gradeLabel}</p>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#18231C]">
                              {item.quantityPerHectareKg} kg
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-[#18231C]">
                              {item.totalQuantityKg} kg
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#556159]">
                              {item.totalBags} × {item.bagWeightKg} kg
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-[#556159]">
                              {contribs.join(' · ')}
                            </td>
                            <td className="py-3.5 pl-3 text-right font-mono tabular-nums font-semibold text-[#18231C]">
                              ₹{item.estimatedPriceInr.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Soil Adjustments */}
                <div className="mt-5 p-4 rounded-lg bg-[#F8F7F4] border border-[#E2DDD3] space-y-1.5 text-xs">
                  <p className="font-semibold text-[#18231C]">ICAR Soil Fertility Adjustment Basis</p>
                  {activeRec.soilAdjustmentNotes.map((n) => (
                    <p key={n} className="text-[#556159]">• {n}</p>
                  ))}
                </div>
              </div>

              {/* Split Application Schedule + Warnings & Sources */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-[#E2DDD3] rounded-xl p-6">
                  <h3 className="font-display text-lg font-semibold text-[#18231C] mb-4">
                    Field Application Split Schedule
                  </h3>
                  <div className="space-y-4">
                    {activeRec.applicationSchedule.map((stage, idx) => (
                      <div key={stage.stage} className="pb-4 border-b last:border-b-0 border-[#EFECE6]">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-[#18231C]">
                            0{idx + 1}. {stage.stage}
                          </h4>
                          <span className="text-xs font-mono text-[#B45D28]">{stage.timing}</span>
                        </div>
                        <p className="text-xs text-[#556159] leading-relaxed mb-2">{stage.instructions}</p>
                        {stage.products.length > 0 && (
                          <div className="text-xs font-mono tabular-nums text-[#18231C]">
                            Apply:{' '}
                            {stage.products.map((p) => `${p.productName} (${p.totalKg} kg)`).join('  ·  ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                  {activeRec.warnings.length > 0 && (
                    <div className="bg-[#FFFBEB] border border-[#B45309]/30 rounded-xl p-5 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#92400E]">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Field Precautions &amp; Compatibility
                      </div>
                      <ul className="space-y-1.5 text-xs text-[#78350F] leading-relaxed">
                        {activeRec.warnings.map((w) => (
                          <li key={w}>• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white border border-[#E2DDD3] rounded-xl p-5 space-y-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#18231C] mb-1">Calculation Assumptions</p>
                      <ul className="space-y-1 text-[#556159] leading-relaxed">
                        {activeRec.assumptions.map((a) => (
                          <li key={a}>• {a}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-[#EFECE6]">
                      <p className="font-semibold text-[#18231C] mb-1">Verified Agronomic Sources</p>
                      <ul className="space-y-1 text-[#556159]">
                        {activeRec.sourceReferences.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Optional Module 5: Exploratory Crop Suitability Explorer */}
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#B45D28]" />
            <div>
              <h3 className="font-display text-lg font-semibold text-[#18231C]">
                Exploratory Crop Suitability Benchmark (Optional)
              </h3>
              <p className="text-xs text-[#556159]">
                Uses Dataset C benchmark climate + soil NPK envelopes. Does not calculate fertilizer doses
                or guarantee yield.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuitabilityOpen((v) => !v)}
            className="h-9 px-3.5 rounded-lg border border-[#D4CEC2] text-xs font-semibold text-[#18231C] hover:bg-[#F8F7F4] whitespace-nowrap"
          >
            {suitabilityOpen ? 'Hide Explorer' : 'Open Suitability Check'}
          </button>
        </div>

        {suitabilityOpen && (
          <div className="mt-5 pt-5 border-t border-[#EFECE6] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-[#18231C] mb-1">Avg Temp (°C)</label>
                <input
                  type="number"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#18231C] mb-1">Humidity (%)</label>
                <input
                  type="number"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#18231C] mb-1">Seasonal Rain (mm)</label>
                <input
                  type="number"
                  value={rainfallMm}
                  onChange={(e) => setRainfallMm(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleRunSuitability}
                disabled={suitabilityLoading}
                className="h-10 px-4 rounded-lg bg-[#1E4631] text-white text-xs font-semibold"
              >
                {suitabilityLoading ? 'Evaluating...' : 'Evaluate Benchmark Match'}
              </button>
            </div>

            {suitabilityResults && (
              <div className="space-y-3">
                <p className="text-xs text-[#B45309] bg-[#FFFBEB] border border-[#B45309]/25 p-3 rounded-lg">
                  {suitabilityResults[0]?.limitationsDisclaimer}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {suitabilityResults.map((item) => (
                    <div key={item.crop} className="p-4 rounded-lg border border-[#E2DDD3] bg-[#F8F7F4]">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className="font-semibold text-sm text-[#18231C]">{item.crop}</p>
                        <span className="font-mono tabular-nums text-xs font-semibold text-[#1E4631]">
                          {item.suitabilityScore}% · {item.suitabilityBand}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#556159]">
                        Limiting: {item.limitingFactors.length > 0 ? item.limitingFactors.slice(0, 2).join('; ') : 'Within benchmark ranges'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
