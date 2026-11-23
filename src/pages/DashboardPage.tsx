import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CloudRain,
  FlaskConical,
  MessageSquare,
  Tractor,
} from 'lucide-react';
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
import type { WeatherAdvisoryResponse } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export function DashboardPage() {
  const {
    user,
    farms,
    activeFarm,
    analyses,
    recommendations,
    districts,
    setPage,
    setSelectedAnalysisId,
    setSelectedRecommendationId,
  } = useApp();

  const [weather, setWeather] = useState<WeatherAdvisoryResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const farmAnalyses = activeFarm
    ? analyses.filter((a) => a.farmId === activeFarm.id)
    : analyses;
  const latestAnalysis = farmAnalyses[0] ?? analyses[0] ?? null;

  const farmRecs = activeFarm
    ? recommendations.filter((r) => r.farmId === activeFarm.id)
    : recommendations;
  const latestRec = farmRecs[0] ?? recommendations[0] ?? null;

  useEffect(() => {
    const dist = activeFarm?.district || 'Ludhiana';
    setWeatherLoading(true);
    api
      .getWeather(dist, activeFarm?.latitude, activeFarm?.longitude, activeFarm?.state)
      .then((res) => setWeather(res.weather))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false));
  }, [activeFarm?.district, activeFarm?.state, activeFarm?.latitude, activeFarm?.longitude]);

  const featuredNames = ['Ludhiana', 'Bareilly', 'Patna', 'Bardhaman', 'Indore', 'Kolhapur', 'Mandya', 'Thanjavur', 'Jorhat'];
  const featuredDistricts = featuredNames
    .map((name) => districts.find((d) => d.district === name))
    .filter((d): d is (typeof districts)[number] => Boolean(d));
  const chartSource = featuredDistricts.length >= 5 ? featuredDistricts : districts.slice(0, 8);

  const districtChartData = chartSource.map((d) => ({
    district: d.district,
    Nitrogen: d.medianNitrogenKgHa,
    Potassium: d.medianPotassiumKgHa,
    Phosphorus10x: Math.round(d.medianPhosphorusKgHa * 10),
  }));

  return (
    <div className="space-y-8">
      {/* Greeting & Active Farm Summary Banner */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E2DDD3]">
        <div>
          <p className="text-xs font-medium text-[#556159] mb-1">
            Farmer Workspace · {activeFarm ? `${activeFarm.village}, ${activeFarm.district}, ${activeFarm.state}` : 'All-India Soil Advisory'}
          </p>
          <h2 className="font-display text-3xl font-semibold text-[#18231C]">
            Namaste, {user?.name?.split(' ')[0]}
          </h2>
          <p className="text-sm text-[#556159] mt-1">
            {activeFarm
              ? `Tracking ${activeFarm.farmName} (${activeFarm.landArea} ${activeFarm.areaUnit} · ${activeFarm.selectedCrop}, ${activeFarm.cropSeason}).`
              : 'Register your first farm plot to run verified soil analyses and ICAR fertilizer calculations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setPage('soil-analysis')}
            className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <FlaskConical className="w-4 h-4" />
            Analyze Soil Sample
          </button>
          <button
            type="button"
            onClick={() => setPage('assistant')}
            className="h-10 px-4 rounded-lg border border-[#D4CEC2] bg-white hover:bg-[#EFECE6]/70 text-[#18231C] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />
            Ask AI Assistant
          </button>
        </div>
      </section>

      {/* Top KPI Summary Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556159]">Registered Farms</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-2">
            {farms.length}
          </p>
          <p className="text-xs text-[#556159] mt-1">
            Total area:{' '}
            <span className="font-mono tabular-nums text-[#18231C]">
              {farms.reduce((s, f) => s + f.areaHectares, 0).toFixed(2)} ha
            </span>
          </p>
        </div>

        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556159]">Verified Soil Tests</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-2">
            {analyses.length}
          </p>
          <p className="text-xs text-[#556159] mt-1">
            {latestAnalysis
              ? `${latestAnalysis.deficienciesCount} deficient · ${latestAnalysis.sufficientCount} sufficient`
              : 'No soil sample recorded yet'}
          </p>
        </div>

        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556159]">Latest Fertilizer Estimate</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-2">
            {latestRec && latestRec.status === 'calculated'
              ? `₹${latestRec.totalEstimatedCostInr.toLocaleString('en-IN')}`
              : '—'}
          </p>
          <p className="text-xs text-[#556159] mt-1">
            {latestRec
              ? latestRec.status === 'calculated'
                ? `${latestRec.crop} · ${latestRec.landAreaDisplay}`
                : 'Flagged for Expert Review'
              : 'Generate from verified soil test'}
          </p>
        </div>

        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556159]">Latest Soil pH &amp; Organic Carbon</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#18231C] mt-2">
            {latestAnalysis
              ? `${latestAnalysis.assessments.find((a) => a.parameterName === 'pH')?.measuredValue ?? '—'} pH`
              : '—'}
          </p>
          <p className="text-xs text-[#556159] mt-1">
            OC:{' '}
            <span className="font-mono tabular-nums text-[#18231C]">
              {latestAnalysis?.assessments.find((a) => a.parameterName === 'OrganicCarbon')?.measuredValue ?? '—'}%
            </span>
          </p>
        </div>
      </section>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Latest Soil Health & Fertilizer Plan Overview */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-[#18231C]">
                  Latest Verified Soil Assessment
                </h3>
                <p className="text-xs text-[#556159] mt-0.5">
                  {latestAnalysis
                    ? `${latestAnalysis.farmName} · ${latestAnalysis.sampleDate} · ${latestAnalysis.labName}`
                    : 'Submit your Soil Health Card to view nutrient diagnostics.'}
                </p>
              </div>
              {latestAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnalysisId(latestAnalysis.id);
                    setPage('soil-results');
                  }}
                  className="text-sm font-medium text-[#1E4631] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Full Results
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {latestAnalysis ? (
              <>
                <p className="text-sm text-[#18231C] bg-[#F8F7F4] border border-[#E2DDD3] rounded-lg p-4 mb-5 leading-relaxed">
                  {latestAnalysis.overallHealthSummary}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2DDD3] text-left text-xs text-[#556159]">
                        <th className="pb-2.5 font-medium">Parameter</th>
                        <th className="pb-2.5 font-medium text-right">Lab Value</th>
                        <th className="pb-2.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {latestAnalysis.assessments
                        .filter((a) =>
                          ['pH', 'OrganicCarbon', 'Nitrogen', 'Phosphorus', 'Potassium', 'Zinc'].includes(
                            a.parameterName,
                          ),
                        )
                        .map((a) => (
                          <tr key={a.parameterName} className="h-10">
                            <td className="font-medium text-[#18231C]">{a.label}</td>
                            <td className="text-right font-mono tabular-nums text-[#18231C]">
                              {a.measuredValue !== null ? `${a.measuredValue} ${a.unit}` : 'Not tested'}
                            </td>
                            <td className="text-right font-medium">
                              <span
                                className={
                                  a.status === 'Deficient' || a.status === 'Low' || a.status === 'Saline'
                                    ? 'text-[#B91C1C]'
                                    : a.status === 'Alkaline' || a.status === 'Acidic' || a.status === 'High'
                                      ? 'text-[#B45309]'
                                      : a.status === 'Missing'
                                        ? 'text-[#556159]'
                                        : 'text-[#15803D]'
                                }
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-[#556159] mb-4">
                  No verified soil test found yet. Upload a Soil Health Card or enter values manually.
                </p>
                <button
                  type="button"
                  onClick={() => setPage(farms.length > 0 ? 'soil-analysis' : 'farms')}
                  className="h-10 px-4 rounded-lg bg-[#1E4631] text-white text-sm font-medium"
                >
                  {farms.length > 0 ? 'Enter First Soil Test' : 'Create First Farm'}
                </button>
              </div>
            )}
          </div>

          {/* Regional All-India Soil Health Baseline Chart (Dataset A) */}
          <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
            <div className="mb-4">
              <h3 className="font-display text-xl font-semibold text-[#18231C]">
                All-India Regional Nutrient Medians
              </h3>
              <p className="text-xs text-[#556159] mt-0.5">
                Dataset A baseline distributions (Available N &amp; K in kg/ha across major agro-climatic zones from Punjab to Tamil Nadu &amp; Assam)
              </p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" />
                  <XAxis dataKey="district" tick={{ fontSize: 12, fill: '#556159' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#556159' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2DDD3',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Nitrogen" name="Median N (kg/ha)" fill="#1E4631" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Potassium" name="Median K (kg/ha)" fill="#B45D28" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Active Fertilizer Plan + Optional Non-Blocking Weather Advisory */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-xl font-semibold text-[#18231C]">
                Active Fertilizer Plan
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (latestRec) setSelectedRecommendationId(latestRec.id);
                  setPage('fertilizer');
                }}
                className="text-sm font-medium text-[#1E4631] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                Open Engine
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {latestRec && latestRec.status === 'calculated' ? (
              <div className="space-y-4">
                <div className="text-xs text-[#556159]">
                  {latestRec.crop} · {latestRec.district} ({latestRec.season}) · {latestRec.landAreaDisplay}
                </div>
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E2DDD3]">
                  <div>
                    <p className="text-[11px] text-[#556159]">Target N</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {latestRec.targetsKgPerHa.N} kg/ha
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#556159]">Target P2O5</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {latestRec.targetsKgPerHa.P2O5} kg/ha
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#556159]">Target K2O</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {latestRec.targetsKgPerHa.K2O} kg/ha
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-[#EFECE6]">
                  {latestRec.lineItems.map((item) => (
                    <div key={item.productName} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-[#18231C]">{item.productName}</p>
                        <p className="text-xs text-[#556159]">{item.gradeLabel}</p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#18231C]">{item.totalQuantityKg} kg</p>
                        <p className="text-xs text-[#556159]">
                          {item.totalBags} bags · ₹{item.estimatedPriceInr.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <Calculator className="w-8 h-8 text-[#B45D28] mx-auto mb-2" />
                <p className="text-sm text-[#556159] mb-4">
                  {latestRec?.status === 'expert_review_required'
                    ? 'Latest crop/district selection requires agricultural expert review.'
                    : 'Generate a deterministic ICAR + FCO 1985 fertilizer schedule from your soil results.'}
                </p>
                <button
                  type="button"
                  onClick={() => setPage('fertilizer')}
                  className="h-10 px-4 rounded-lg border border-[#1E4631] text-[#1E4631] hover:bg-[#1E4631] hover:text-white text-sm font-medium transition-colors"
                >
                  Open Fertilizer Optimizer
                </button>
              </div>
            )}
          </div>

          {/* Module 9: Optional Non-Blocking Weather Advisory */}
          <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-[#1E4631]" />
                <h3 className="font-display text-lg font-semibold text-[#18231C]">
                  Field Weather Advisory
                </h3>
              </div>
              <span className="text-xs text-[#556159]">
                {weather?.district || activeFarm?.district || 'Ludhiana'}
                {activeFarm?.state ? `, ${activeFarm.state}` : ''}
              </span>
            </div>

            {weatherLoading && !weather ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-6 bg-[#EFECE6] rounded w-1/2" />
                <div className="h-4 bg-[#EFECE6] rounded w-full" />
              </div>
            ) : weather ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E2DDD3]">
                  <div>
                    <p className="text-[11px] text-[#556159]">Temp</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {weather.temperatureC}°C
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#556159]">Humidity</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {weather.humidityPct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#556159]">72h Rain</p>
                    <p className="font-mono tabular-nums text-base font-semibold text-[#18231C]">
                      {weather.rainfallNext72hMm} mm
                    </p>
                  </div>
                </div>
                <div className="text-xs space-y-2 text-[#18231C] leading-relaxed">
                  <p>
                    <span className="font-semibold">Application Timing:</span> {weather.fertilizerTimingWarning}
                  </p>
                  <p>
                    <span className="font-semibold">Irrigation Note:</span> {weather.irrigationAdvice}
                  </p>
                  <p className="text-[11px] text-[#556159]">{weather.source}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#556159]">
                Weather advisory unavailable. Soil analysis and fertilizer calculations remain fully operational.
              </p>
            )}
          </div>

          {/* Quick Farm Shortcut */}
          <div className="bg-[#EFECE6]/70 border border-[#E2DDD3] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Tractor className="w-5 h-5 text-[#1E4631] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#18231C]">Manage Multiple Plots</p>
                <p className="text-xs text-[#556159]">Add another village plot, crop season, or growth stage.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPage('farms')}
              className="h-9 px-3.5 rounded-lg bg-white border border-[#D4CEC2] text-xs font-semibold text-[#18231C] hover:bg-[#F8F7F4] whitespace-nowrap"
            >
              Manage Farms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
