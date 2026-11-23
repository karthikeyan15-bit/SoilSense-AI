import React, { useState } from 'react';
import { Calculator, FileDown, MessageSquare } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export function SoilResultsPage() {
  const {
    analyses,
    selectedAnalysisId,
    setSelectedAnalysisId,
    refreshWorkspaceData,
    setPage,
    notify,
  } = useApp();

  const [exporting, setExporting] = useState(false);

  const analysis =
    analyses.find((a) => a.id === selectedAnalysisId) ?? analyses[0] ?? null;

  if (!analysis) {
    return (
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-[#18231C] mb-2">
          No Soil Analyses Available
        </h2>
        <p className="text-sm text-[#556159] mb-5">
          Submit a manual soil test or upload a Soil Health Card to view detailed parameter diagnostics.
        </p>
        <button
          type="button"
          onClick={() => setPage('soil-analysis')}
          className="h-10 px-5 rounded-lg bg-[#1E4631] text-white text-sm font-semibold"
        >
          Start Soil Analysis
        </button>
      </div>
    );
  }

  const macroChartData = analysis.assessments
    .filter((a) => ['Nitrogen', 'Phosphorus', 'Potassium'].includes(a.parameterName) && a.measuredValue !== null)
    .map((a) => ({
      nutrient: a.parameterName,
      Tested: a.normalizedValue ?? a.measuredValue ?? 0,
      DistrictMedian: a.regionalMedian ?? 0,
    }));

  const microChartData = analysis.assessments
    .filter(
      (a) =>
        ['Sulphur', 'Zinc', 'Iron', 'Boron', 'Copper', 'Manganese'].includes(a.parameterName) &&
        a.measuredValue !== null,
    )
    .map((a) => ({
      nutrient: a.parameterName,
      TestedPpm: a.normalizedValue ?? a.measuredValue ?? 0,
      DistrictMedian: a.regionalMedian ?? 0,
    }));

  const handleQuickPdf = async () => {
    setExporting(true);
    try {
      const res = await api.generateReport({ soilAnalysisId: analysis.id });
      await refreshWorkspaceData();
      const url = api.getReportDownloadUrl(res.report.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify('success', 'PDF soil advisory generated and download started.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2DDD3]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold text-[#18231C]">
              {analysis.farmName}
            </h2>
            {analyses.length > 1 && (
              <select
                aria-label="Select soil analysis record"
                value={analysis.id}
                onChange={(e) => setSelectedAnalysisId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#D4CEC2] bg-white text-xs font-medium text-[#18231C]"
              >
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.sampleDate} — {a.farmName} ({a.crop})
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-[#556159]">
            {analysis.district}{analysis.state ? `, ${analysis.state}` : ''} · Crop: {analysis.crop} · Sample Date:{' '}
            {analysis.sampleDate} · Depth: {analysis.sampleDepth} · Lab: {analysis.labName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setPage('fertilizer')}
            className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Calculator className="w-4 h-4" />
            Calculate Fertilizer Plan
          </button>
          <button
            type="button"
            onClick={() => setPage('assistant')}
            className="h-10 px-4 rounded-lg border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />
            Explain in Local Language
          </button>
          <button
            type="button"
            onClick={handleQuickPdf}
            disabled={exporting}
            className="h-10 px-4 rounded-lg border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Health Summary Strip */}
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <p className="text-xs font-medium text-[#556159] mb-1">Soil Health Summary</p>
            <p className="text-base text-[#18231C] leading-relaxed">{analysis.overallHealthSummary}</p>
          </div>
          <div className="lg:col-span-4 grid grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-[#EFECE6] pt-4 lg:pt-0 lg:pl-6">
            <div>
              <p className="text-xs text-[#556159]">Deficient / Low</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#B91C1C]">
                {analysis.deficienciesCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#556159]">Sufficient</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#15803D]">
                {analysis.sufficientCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#556159]">High / Alkaline</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#B45309]">
                {analysis.excessCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts: Macro NPK & Micronutrients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold text-[#18231C] mb-1">
            Primary Macronutrients vs Regional Median
          </h3>
          <p className="text-xs text-[#556159] mb-4">
            Normalized to kg/ha vs {analysis.district}{analysis.state ? ` (${analysis.state})` : ''} regional baseline
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={macroChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" />
                <XAxis dataKey="nutrient" tick={{ fontSize: 12, fill: '#556159' }} />
                <YAxis tick={{ fontSize: 12, fill: '#556159' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Tested" name="Your Soil (kg/ha)" fill="#1E4631" radius={[3, 3, 0, 0]} />
                <Bar dataKey="DistrictMedian" name={`${analysis.district} Median`} fill="#C5B9A5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold text-[#18231C] mb-1">
            Secondary &amp; Micronutrient Levels
          </h3>
          <p className="text-xs text-[#556159] mb-4">DTPA / extractable concentrations (ppm)</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={microChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" />
                <XAxis dataKey="nutrient" tick={{ fontSize: 12, fill: '#556159' }} />
                <YAxis tick={{ fontSize: 12, fill: '#556159' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="TestedPpm" name="Your Soil (ppm)" fill="#B45D28" radius={[3, 3, 0, 0]} />
                <Bar dataKey="DistrictMedian" name={`${analysis.district} Median`} fill="#C5B9A5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed 13-Parameter Assessment Table */}
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold text-[#18231C] mb-4">
          Complete Parameter Diagnostics &amp; Thresholds
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2DDD3] text-left text-xs text-[#556159]">
                <th className="pb-2.5 pr-4 font-medium">Parameter</th>
                <th className="pb-2.5 px-3 font-medium text-right">Lab Value</th>
                <th className="pb-2.5 px-3 font-medium">ICAR Threshold</th>
                <th className="pb-2.5 px-3 font-medium">Status</th>
                <th className="pb-2.5 pl-3 font-medium">Agronomic Interpretation &amp; Regional Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6]">
              {analysis.assessments.map((a) => (
                <tr key={a.parameterName} className="align-top">
                  <td className="py-3 pr-4 font-medium text-[#18231C] whitespace-nowrap">{a.label}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-[#18231C]">
                    {a.measuredValue !== null ? `${a.measuredValue} ${a.unit}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-xs text-[#556159] whitespace-nowrap">{a.thresholdRange}</td>
                  <td className="py-3 px-3 font-semibold whitespace-nowrap">
                    <span
                      className={
                        a.status === 'Deficient' || a.status === 'Low' || a.status === 'Saline'
                          ? 'text-[#B91C1C]'
                          : a.status === 'Alkaline' || a.status === 'Acidic' || a.status === 'High' || a.status === 'Excess'
                            ? 'text-[#B45309]'
                            : a.status === 'Missing'
                              ? 'text-[#556159]'
                              : 'text-[#15803D]'
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-xs text-[#556159] leading-relaxed">
                    <p className="text-[#18231C]">{a.explanation}</p>
                    {a.regionalStatus && (
                      <p className="mt-1 font-mono text-[11px] text-[#556159]">{a.regionalStatus}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Missing Parameters & Sources */}
        <div className="mt-6 pt-5 border-t border-[#E2DDD3] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#556159]">
          <div>
            <p className="font-semibold text-[#18231C] mb-1">Missing / Untested Parameters</p>
            <p>
              {analysis.missingParameters.length > 0
                ? analysis.missingParameters.join(', ')
                : 'All 13 Soil Health Card parameters were provided in this sample.'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#18231C] mb-1">Authoritative References</p>
            <ul className="space-y-0.5">
              {analysis.sourceReferences.map((ref) => (
                <li key={ref}>• {ref}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
