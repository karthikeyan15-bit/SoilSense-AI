import React, { useState } from 'react';
import { ArrowRight, FileDown, FilePlus2, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export function HistoryReportsPage() {
  const {
    analyses,
    recommendations,
    reports,
    setSelectedAnalysisId,
    setSelectedRecommendationId,
    setPage,
    refreshWorkspaceData,
    notify,
  } = useApp();

  const [tab, setTab] = useState<'analyses' | 'recommendations' | 'reports'>('analyses');
  const [search, setSearch] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const q = search.trim().toLowerCase();

  const filteredAnalyses = analyses.filter(
    (a) =>
      !q ||
      a.farmName.toLowerCase().includes(q) ||
      a.district.toLowerCase().includes(q) ||
      a.crop.toLowerCase().includes(q) ||
      a.sampleDate.includes(q),
  );

  const filteredRecs = recommendations.filter(
    (r) =>
      !q ||
      r.farmName.toLowerCase().includes(q) ||
      r.district.toLowerCase().includes(q) ||
      r.crop.toLowerCase().includes(q),
  );

  const filteredReports = reports.filter(
    (r) =>
      !q ||
      r.reportTitle.toLowerCase().includes(q) ||
      r.farmName.toLowerCase().includes(q) ||
      r.crop.toLowerCase().includes(q),
  );

  const triggerDownload = (reportId: string) => {
    const url = api.getReportDownloadUrl(reportId);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateAndDownload = async (analysisId: string, recommendationId?: string | null) => {
    setGeneratingFor(recommendationId || analysisId);
    try {
      const res = await api.generateReport({
        soilAnalysisId: analysisId,
        recommendationId: recommendationId ?? null,
      });
      await refreshWorkspaceData();
      triggerDownload(res.report.id);
      notify('success', 'PDF report saved to history and download started.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('analyses')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'analyses' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
            }`}
          >
            Soil Analyses ({analyses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('recommendations')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'recommendations' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
            }`}
          >
            Fertilizer Plans ({recommendations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'reports' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
            }`}
          >
            PDF Reports ({reports.length})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#556159] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by farm, district, or crop..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D4CEC2] bg-white text-sm focus:outline-none focus:border-[#1E4631]"
          />
        </div>
      </div>

      {/* Tab 1: Soil Analyses History */}
      {tab === 'analyses' && (
        <div className="bg-white border border-[#E2DDD3] rounded-xl overflow-hidden">
          {filteredAnalyses.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#556159]">
              No matching soil analysis records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2DDD3] bg-[#F8F7F4] text-left text-xs text-[#556159]">
                    <th className="py-3 px-5 font-medium">Sample Date</th>
                    <th className="py-3 px-4 font-medium">Farm &amp; District</th>
                    <th className="py-3 px-4 font-medium">Crop</th>
                    <th className="py-3 px-4 font-medium">Findings</th>
                    <th className="py-3 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {filteredAnalyses.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F8F7F4]/60">
                      <td className="py-3.5 px-5 font-mono tabular-nums text-xs text-[#556159] whitespace-nowrap">
                        {a.sampleDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#18231C]">{a.farmName}</p>
                        <p className="text-xs text-[#556159]">{a.district} · {a.labName}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[#18231C]">{a.crop}</td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="text-[#B91C1C] font-medium">{a.deficienciesCount} deficient</span>
                        <span className="mx-1.5 text-[#C9C2B6]">·</span>
                        <span className="text-[#15803D] font-medium">{a.sufficientCount} sufficient</span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAnalysisId(a.id);
                            setPage('soil-results');
                          }}
                          className="h-8 px-3 rounded-md border border-[#D4CEC2] text-xs font-medium text-[#18231C] hover:bg-[#EFECE6] inline-flex items-center gap-1"
                        >
                          View
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateAndDownload(a.id)}
                          disabled={generatingFor === a.id}
                          className="h-8 px-3 rounded-md bg-[#1E4631] text-white text-xs font-medium hover:bg-[#163625] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FilePlus2 className="w-3 h-3" />
                          {generatingFor === a.id ? 'Creating...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Fertilizer Plans History */}
      {tab === 'recommendations' && (
        <div className="bg-white border border-[#E2DDD3] rounded-xl overflow-hidden">
          {filteredRecs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#556159]">
              No fertilizer recommendations saved yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2DDD3] bg-[#F8F7F4] text-left text-xs text-[#556159]">
                    <th className="py-3 px-5 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium">Farm &amp; Crop</th>
                    <th className="py-3 px-4 font-medium">Targets (N-P2O5-K2O)</th>
                    <th className="py-3 px-4 font-medium text-right">Est. Cost</th>
                    <th className="py-3 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {filteredRecs.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F8F7F4]/60">
                      <td className="py-3.5 px-5 font-mono tabular-nums text-xs text-[#556159] whitespace-nowrap">
                        {r.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#18231C]">
                          {r.farmName} · {r.crop} ({r.season})
                        </p>
                        <p className="text-xs text-[#556159]">
                          {r.district} · {r.landAreaDisplay}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                        {r.status === 'calculated' ? (
                          `${r.targetsKgPerHa.N} - ${r.targetsKgPerHa.P2O5} - ${r.targetsKgPerHa.K2O} kg/ha`
                        ) : (
                          <span className="text-[#B91C1C] font-sans font-medium">Expert Review Required</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#18231C]">
                        {r.status === 'calculated' ? `₹${r.totalEstimatedCostInr.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecommendationId(r.id);
                            setPage('fertilizer');
                          }}
                          className="h-8 px-3 rounded-md border border-[#D4CEC2] text-xs font-medium text-[#18231C] hover:bg-[#EFECE6]"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateAndDownload(r.soilAnalysisId, r.id)}
                          disabled={generatingFor === r.id}
                          className="h-8 px-3 rounded-md bg-[#1E4631] text-white text-xs font-medium hover:bg-[#163625] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileDown className="w-3 h-3" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Saved PDF Reports */}
      {tab === 'reports' && (
        <div className="bg-white border border-[#E2DDD3] rounded-xl overflow-hidden">
          {filteredReports.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#556159]">
              No PDF reports generated yet. Click &ldquo;PDF&rdquo; on any soil analysis or fertilizer plan
              to create a downloadable SoilSense AI advisory document.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2DDD3] bg-[#F8F7F4] text-left text-xs text-[#556159]">
                    <th className="py-3 px-5 font-medium">Generated</th>
                    <th className="py-3 px-4 font-medium">Report Title</th>
                    <th className="py-3 px-4 font-medium">Farm &amp; Crop</th>
                    <th className="py-3 px-5 font-medium text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {filteredReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-[#F8F7F4]/60">
                      <td className="py-3.5 px-5 font-mono tabular-nums text-xs text-[#556159] whitespace-nowrap">
                        {rep.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#18231C]">{rep.reportTitle}</td>
                      <td className="py-3.5 px-4 text-xs text-[#556159]">
                        {rep.farmName} · {rep.crop}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => triggerDownload(rep.id)}
                          className="h-8 px-3.5 rounded-md bg-[#1E4631] hover:bg-[#163625] text-white text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
