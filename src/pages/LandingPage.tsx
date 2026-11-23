import React, { useState } from 'react';
import { ArrowRight, Check, Sprout } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function LandingPage() {
  const { setPage, loginDemoFarmer, notify } = useApp();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await loginDemoFarmer();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to start demo session.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#18231C]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-20 bg-[#F8F7F4]/95 backdrop-blur border-b border-[#E2DDD3]">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-semibold tracking-tight text-[#18231C] whitespace-nowrap shrink-0"
          >
            SoilSense AI
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#556159]">
            <a href="#workflow" className="hover:text-[#18231C] transition-colors whitespace-nowrap shrink-0">
              Workflow
            </a>
            <a href="#agronomy" className="hover:text-[#18231C] transition-colors whitespace-nowrap shrink-0">
              Agronomy Rules
            </a>
            <a href="#india-coverage" className="hover:text-[#18231C] transition-colors whitespace-nowrap shrink-0">
              All-India Data
            </a>
            <a href="#languages" className="hover:text-[#18231C] transition-colors whitespace-nowrap shrink-0">
              Languages
            </a>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setPage('auth')}
              className="h-10 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split Section */}
        <section className="max-w-[1280px] mx-auto px-6 pt-12 pb-10 lg:pt-16 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#B45D28] mb-3">
                All-India Soil Intelligence · 28 States &amp; 8 UTs · ICAR &amp; FCO 1985 Verified
              </p>
              <h1 className="font-display headline-balance text-4xl sm:text-5xl font-semibold tracking-tight text-[#18231C] leading-[1.12] mb-5">
                Transparent soil science and fertilizer plans for Indian farmers.
              </h1>
              <p className="text-base sm:text-lg text-[#556159] leading-relaxed max-w-xl mb-8">
                Upload a Soil Health Card or enter laboratory values manually from any Indian state or
                district. SoilSense AI validates all 13 soil parameters, calculates deterministic ICAR
                &amp; FCO fertilizer quantities with multi-nutrient accounting, and explains every decision
                in Hindi, English, Kannada, Tamil, or Telugu.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={demoLoading}
                  className="h-12 px-6 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
                >
                  {demoLoading ? 'Opening Demo Farms...' : 'Explore All-India Demo Farms'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage('auth')}
                  className="h-12 px-6 rounded-lg border border-[#D4CEC2] bg-white hover:bg-[#EFECE6]/70 text-[#18231C] text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Register Farmer Account
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-[#E2DDD3] bg-[#EFECE6]">
                <img
                  src="/src/assets/images/hero_karnataka_paddy_1795425502562.jpg"
                  alt="Irrigated green farmland and fertile loam fields across India at golden hour"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#18231C]/85 via-[#18231C]/40 to-transparent p-6">
                  <p className="text-xs text-[#E8ECE9]">
                    Pan-India Agro-Climatic Coverage · Indo-Gangetic Plains, Deccan Vertisols, Eastern Deltas &amp; Coastal Belts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Proof Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-[#E2DDD3] grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[#18231C]">
                28 States &amp; 8 UTs
              </p>
              <p className="text-sm text-[#556159] mt-1">
                All-India Soil Health Portal baselines &amp; ICAR-IISS district/state standards
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[#18231C]">
                13 Parameters
              </p>
              <p className="text-sm text-[#556159] mt-1">
                Macro, secondary, micronutrient &amp; unit-preserved lab verification
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[#18231C]">
                5 Languages
              </p>
              <p className="text-sm text-[#556159] mt-1">
                Hindi, English, Kannada, Tamil &amp; Telugu grounded RAG explanations
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[#18231C]">
                Zero AI Math
              </p>
              <p className="text-sm text-[#556159] mt-1">
                100% deterministic ICAR &amp; FCO 1985 fertilizer optimizer
              </p>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="border-t border-[#E2DDD3] bg-white py-16">
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <h2 className="font-display headline-balance text-3xl sm:text-4xl font-semibold text-[#18231C] mb-3">
                Built on verified agronomy, never guessed dosages.
              </h2>
              <p className="text-base text-[#556159] leading-relaxed">
                Every recommendation follows an auditable chain from verified lab values to statutory
                fertilizer product grades and split field application timing.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 space-y-6">
                <div className="p-6 rounded-xl border border-[#E2DDD3] bg-[#F8F7F4]">
                  <h3 className="font-display text-xl font-semibold text-[#18231C] mb-2">
                    01. Soil Lab Intake &amp; Unit Preservation
                  </h3>
                  <p className="text-sm text-[#556159] leading-relaxed">
                    Enter Soil Health Card values manually or upload a PDF or photograph. Extracted values
                    always open in an editable verification table before saving, preserving original
                    laboratory units (<span className="font-mono">kg/ha</span> vs <span className="font-mono">mg/kg</span>)
                    and preventing duplicate submissions.
                  </p>
                </div>

                <div className="p-6 rounded-xl border border-[#E2DDD3] bg-[#F8F7F4]">
                  <h3 className="font-display text-xl font-semibold text-[#18231C] mb-2">
                    02. Deterministic ICAR &amp; FCO Multi-Nutrient Optimizer
                  </h3>
                  <p className="text-sm text-[#556159] leading-relaxed">
                    Matches crop, Indian state/district, and season against ICAR-IISS district nutrient
                    standards and Fertiliser Control Order (1985) grades. Credits DAP&apos;s 18% nitrogen
                    contribution before computing Urea, scales quantities to your exact farm area (acres,
                    hectares, bighas, or guntas), and triggers an explicit Expert Review hold when no
                    validated rule exists.
                  </p>
                </div>

                <div className="p-6 rounded-xl border border-[#E2DDD3] bg-[#F8F7F4]">
                  <h3 className="font-display text-xl font-semibold text-[#18231C] mb-2">
                    03. Multilingual RAG Assistant &amp; Downloadable PDF Advisory
                  </h3>
                  <p className="text-sm text-[#556159] leading-relaxed">
                    Ask why a nutrient is deficient or how to time top-dressing in Hindi, English, Kannada,
                    Tamil, or Telugu. Every explanation cites retrieved ICAR-IISS, FCO 1985, and Indian
                    State Agricultural University (PAU, IARI, TNAU, UAS, MPKV, AAU) references, and exports
                    cleanly as a printable PDF.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="flex-1 rounded-xl overflow-hidden border border-[#E2DDD3] bg-[#EFECE6] min-h-[240px]">
                  <img
                    src="/src/assets/images/editorial_soil_lab_1795425501125.jpg"
                    alt="Dark fertile loam soil sample in a laboratory testing dish beside brass core sampler and field notebook"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 rounded-xl overflow-hidden border border-[#E2DDD3] bg-[#EFECE6] min-h-[240px]">
                  <img
                    src="/src/assets/images/editorial_field_advisory_1795425501135.jpg"
                    alt="Farmer and agronomist inspecting young crops and soil structure in an Indian agricultural field"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Agronomy Safety & All-India Evidence */}
        <section id="agronomy" className="border-t border-[#E2DDD3] py-16">
          <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5" id="india-coverage">
              <h2 className="font-display headline-balance text-3xl font-semibold text-[#18231C] mb-4">
                Strict separation of datasets and AI responsibilities.
              </h2>
              <p className="text-sm sm:text-base text-[#556159] leading-relaxed mb-6">
                SoilSense AI isolates national Soil Health Card baselines, statutory fertilizer
                compositions, and exploratory benchmarks so farmers across India never receive unverified
                prescriptions.
              </p>
              <ul className="space-y-3 text-sm text-[#18231C]">
                {[
                  'Dataset A (All-India SHC Portal) benchmarks regional medians & detects anomalies.',
                  'Dataset D (ICAR-IISS June 2026) drives district & state N, P2O5 & K2O targets.',
                  'Dataset E (FCO 1985) supplies statutory Urea, DAP, MOP & SSP grades nationwide.',
                  'Gemini 4 Hydrogen explains & translates — never invents fertilizer kg.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#1E4631] mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7" id="languages">
              <div className="bg-white border border-[#E2DDD3] rounded-xl p-6 sm:p-8">
                <h3 className="font-display text-2xl font-semibold text-[#18231C] mb-2">
                  Multilingual Field Clarity Across India
                </h3>
                <p className="text-sm text-[#556159] mb-6">
                  Farmers can switch their preferred explanation language at any time across the AI
                  assistant and profile preferences.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { code: 'HI', native: 'हिन्दी', name: 'Hindi (North & Central)' },
                    { code: 'EN', native: 'English', name: 'English (Pan-India)' },
                    { code: 'KN', native: 'ಕನ್ನಡ', name: 'Kannada (Karnataka)' },
                    { code: 'TA', native: 'தமிழ்', name: 'Tamil (Tamil Nadu)' },
                    { code: 'TE', native: 'తెలుగు', name: 'Telugu (AP & Telangana)' },
                  ].map((lang) => (
                    <div
                      key={lang.code}
                      className="p-4 rounded-lg border border-[#E2DDD3] bg-[#F8F7F4]"
                    >
                      <p className="text-lg font-semibold text-[#18231C]">{lang.native}</p>
                      <p className="text-xs text-[#556159] mt-0.5">{lang.name}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-[#E2DDD3] flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-[#556159]">
                    Unified Node.js + Express.js + React architecture ready for Vercel &amp; Render.
                  </p>
                  <button
                    type="button"
                    onClick={handleDemo}
                    disabled={demoLoading}
                    className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Launch Demo Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E2DDD3] bg-white py-8">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#556159]">
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-[#1E4631]" />
            <span className="font-semibold text-[#18231C]">SoilSense AI</span>
            <span aria-hidden="true">·</span>
            <span>All-India Soil Advisory · ICAR &amp; FCO 1985 Reference Architecture</span>
          </div>
          <p>Always verify commercial product rates and regional advisories with your district Krishi Vigyan Kendra (KVK).</p>
        </div>
      </footer>
    </div>
  );
}
