# SoilSense AI — Node.js & Express Unified Architecture Plan

SoilSense AI is a multilingual agricultural decision-support web platform built for Indian farmers (piloting in Karnataka), re-architected from the original Django specification into a single unified **React + Node.js / Express.js** deployment ready for both **Vercel (serverless functions)** and **Render**. It combines deterministic ICAR/FCO agronomic fertilizer calculations, soil report extraction and verification, regional Karnataka soil benchmarking, downloadable PDF reports, and a grounded multilingual AI assistant.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below reflect your confirmed choices from Phase 1 and key engineering safeguards required for unified Vercel/Render deployment and agronomic safety. Please review and approve before implementation begins.

- **Confirmed Decision 1 — Full MVP + Data Foundation**: Build all 10 frontend pages, the full `/api/v1/*` Express REST API, deterministic ICAR/FCO fertilizer engine, multimodal soil report extraction, multilingual RAG assistant, PDF report generator, and the Karnataka dataset registry, data dictionary, and validation pipeline.
- **Confirmed Decision 2 — Zero-Config SQLite + PostgreSQL-Ready Repository**: Use a portable zero-native-dependency SQLite database layer for instant startup in local development, Render, and Vercel serverless environments (persisting to disk locally/Render and `/tmp` on Vercel), wrapped behind a clean repository interface ready to switch to PostgreSQL via `DATABASE_URL` in production.
- **Confirmed Decision 3 — Gemini Primary + Optional NVIDIA Fallback**: Route all AI calls strictly through Express backend endpoints using `@google/genai` (`gemini-4-hydrogen`) via `process.env.GEMINI_API_KEY`, with optional NVIDIA NIM text fallback via `process.env.NVIDIA_API_KEY`. API keys are never hardcoded or exposed to the React client.
- **Confirmed Decision 4 — Warm Agrarian Editorial Aesthetic**: Light, high-legibility sunlit parchment canvas with deep forest-loam primary actions, warm ochre accents, `Fraunces` editorial headings, `Plus Jakarta Sans` UI typography, and `IBM Plex Mono` tabular numerals for lab values and fertilizer doses.
- **Agronomic Calculation Safety Guardrail**: In accordance with the project specification, Gemini never calculates or invents fertilizer quantities. All N, P2O5, K2O targets and Urea/DAP/MOP product mixes are computed deterministically from verified ICAR district recommendations and Fertiliser Control Order (1985) nutrient grades; unsupported crop/district pairs explicitly flag for agricultural expert review rather than guessing.

---

## 1. Overview & Core Concept

- **What It Does**: Farmers register and manage one or more farms, enter 13-parameter soil lab results manually or upload a PDF/photo soil health card for AI-assisted extraction, verify and edit extracted units/values before saving, receive source-backed nutrient assessments compared against Karnataka regional baselines, generate cost-optimized fertilizer schedules with multi-nutrient accounting (e.g., DAP nitrogen credit reducing Urea dose), converse with a multilingual RAG assistant (English, Kannada, Tamil, Telugu, Hindi) grounded in ICAR and FCO references, and download print-ready PDF advisory reports.
- **Target Audience / Persona**: Indian smallholder and progressive farmers (starting with Karnataka districts such as Mandya, Mysuru, Belagavi, Dharwad, Davanagere, Hassan, Tumakuru, and Raichur), agricultural extension advisors, and agronomy students/researchers.
- **Key Value**: Replaces opaque guesswork and risky LLM-hallucinated dosages with transparent, verifiable agronomic math, unit preservation (`kg/ha` vs `mg/kg`/`ppm`), regional language clarity, and a single-repo Node.js deployment that runs seamlessly on Vercel serverless or Render without separate Python infrastructure.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Discovery & Onboarding (Landing → Register/Login)**:
   - Visitors land on an editorial overview explaining the three-stage SoilSense workflow (Verify Soil Lab Data → Compute ICAR/FCO Fertilizer Plan → Translate & Explain in Local Language), backed by concrete Karnataka Soil Health pilot statistics and ICAR/FCO source provenance.
   - Farmers can register with email, password, and preferred language, log in with JWT session management, or click **Explore Karnataka Demo Farm** to sign into a seeded Mandya Paddy & Sugarcane farmer profile immediately.
2. **Workspace Overview (Dashboard & Farm Management)**:
   - Persistent desktop sidebar (`256px`) paired with a compact contextual top bar (breadcrumb trail + single primary action) and responsive mobile navigation drawer.
   - Dashboard presents active farm summary, latest verified soil test health status, Karnataka district baseline comparison chart, quick links to run a new soil test or view fertilizer plans, and an optional non-blocking district weather advisory card.
   - Farm Management lets farmers create, edit, and switch between multiple farms with area unit conversion (Hectares, Acres, Guntas), Karnataka district/village selectors, crop, season (Kharif/Rabi/Summer), and growth stage.
3. **Soil Input & Verification (Soil Analysis → Soil Results)**:
   - Two-mode intake: **Manual Lab Entry** (all 13 parameters: pH, N, P, K, EC, Organic Carbon, S, Zn, Fe, B, Cu, Mn, Moisture, with explicit lab unit selectors, sampling depth, and lab name) or **Upload Soil Health Card (PDF / Image)**.
   - Uploaded documents pass through server-side multimodal extraction, displaying an editable **Verify & Correct Values** ledger showing original lab values, units, and confidence notes before final submission. Duplicate report hashes are detected and prevented.
   - Submitting runs the deterministic Soil Rule Engine and transitions to **Soil Results**: a clean high-density nutrient status table (Deficient / Sufficient / Excess signaled via both semantic color and explicit text labels), interactive Recharts comparison bars against ICAR sufficiency thresholds and Karnataka district norms, missing-parameter callouts, and source references.
4. **Deterministic Fertilizer Plan (Fertilizer Recommendation)**:
   - Selects a verified soil analysis, target crop, season, growth stage, and available FCO-grade products (Urea 46% N, DAP 18% N / 46% P2O5, MOP 60% K2O, SSP 16% P2O5, Zinc Sulphate 21% Zn).
   - Displays exact Target N, P2O5, and K2O requirements (`kg/ha`), step-by-step multi-nutrient credit accounting, optimized product quantities per hectare and scaled to total farm area (in both `kg` and standard commercial bags), estimated INR cost breakdown, split basal/top-dressing application schedule, and explicit assumptions + ICAR/FCO citations.
   - If a crop/district combination is outside verified ICAR rules, the UI clearly displays the **Expert Review Required** advisory without fabricating numbers.
   - Also includes an optional **Crop Suitability Explorer** (NPK + temperature/humidity/rainfall) clearly labeled as an exploratory benchmark with documented limitations.
5. **Multilingual AI Assistant & PDF Reports (AI Assistant, History & Reports, Profile Settings)**:
   - **AI Assistant**: Split layout with active farm/soil/recommendation context inspector on the side and conversational thread in the main canvas. Language toggle switches between English, Kannada, Tamil, Telugu, and Hindi. Every answer cites retrieved agronomic knowledge-base sources inline.
   - **History & Reports**: Filterable ledger of all past soil analyses, fertilizer recommendations, and generated reports, with one-click **Generate PDF** and **Download PDF** actions.
   - **Profile Settings**: Update farmer name, phone, preferred language, and inspect the built-in **Dataset Governance & Methodology** registry (Datasets A–F licenses, coverage, and Karnataka preprocessing quality metrics).

### Visual Identity & Theme

- **Aesthetic Direction**: *Warm Agrarian Editorial* — inspired by botanical field journals and modern agronomic lab ledgers. High-clarity daytime readability suited for both office advisors and sunlit rural screens.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - *60% Neutral Canvas*: `--background: #F8F7F4` (quiet warm alabaster, `<4%` saturation).
  - *30% Structural Surfaces*: `--surface: #FFFFFF`, `--surface-muted: #EFECE6`, `--border: #E2DDD3` (1px hairline dividers, single-level card elevation, no nested cards within cards).
  - *10% Accent Budget*: `--primary: #1E4631` (deep agrarian forest green for primary CTAs & active navigation), `--accent: #B45D28` (muted clay ochre strictly for secondary highlights and chart contrast).
  - *Typography Ink*: `--foreground: #18231C`, `--muted-foreground: #556159` (WCAG AA compliant).
  - *Semantic Data States (always paired with text labels)*: Sufficient `#15803D`, Marginal/Caution `#B45309`, Deficient/Excess Alert `#B91C1C`.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display / Editorial Headings*: `Fraunces` (600–700 weight, tight tracking, `text-wrap: balance` to prevent orphan headline words).
  - *UI & Body Prose*: `Plus Jakarta Sans` (400 regular, 600 semibold; 15px–16px prose, 13px–14px compact data grids).
  - *Data & Telemetry*: `IBM Plex Mono` with `font-variant-numeric: tabular-nums` on every soil test reading, nutrient ratio, bag count, and INR figure.
- **Component Styling & Anti-Slop Discipline**:
  - Top bar on Landing Page strictly follows the 3-zone contract (single-element wordmark, 4 concise single-line nav links, 1 primary CTA).
  - Workspace uses clean hairline-bordered tables, unboxed metadata separated by `·`, zero static pill badges or thick left accent bars, zero fake telemetry tickers, and touch targets `≥ 40px` (`≥ 44px` on mobile).
- **Visual Assets**: Generate curated editorial agrarian photography via `generate_image` (a sunlit Karnataka paddy & soil field hero image and an editorial soil sample lab-card photography visual) with graceful fallback containers.
- **Interactive Feedback & Motion**: Smooth `150ms`–`200ms` transitions (`cubic-bezier(0.16, 1, 0.3, 1)`), skeleton loading rows matching table geometry, explicit validation messages on soil inputs, toast notifications for saved records and PDF downloads, and clear error banners when upstream AI calls fail.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Dual-Target Express Entry Point (Vercel Serverless + Render / AI Studio Node Server)**
  - *Chosen Approach*: Keep all Express routing, middleware, and business services in a reusable Express `app` factory exported both as a Vercel Serverless Function handler (paired with SPA rewrite rules in Vercel configuration) and mounted inside the standalone Node HTTP + Vite server for local development, AI Studio preview, and Render deployment.
  - *Why*: Guarantees identical API behavior (`/api/v1/*`) across AI Studio, Vercel serverless, and Render single-container hosting without maintaining two backends.
  - *Alternatives Considered*: Rewriting every endpoint into isolated Next.js or standalone Vercel function files — rejected because it fragments shared JWT middleware, service layers, and Render compatibility.

- **Decision 2 — Portable Zero-Native SQLite Storage with Repository Abstraction**
  - *Chosen Approach*: Use pure-JS/WASM SQLite (`sql.js`) backed by persistent disk storage on local/Render environments and ephemeral `/tmp` storage on Vercel serverless, abstracted behind an async repository layer designed to swap cleanly to PostgreSQL when `DATABASE_URL` is configured.
  - *Why*: Native C++ SQLite binaries frequently break Vercel serverless builds across Linux runtimes; `sql.js` runs everywhere with zero build toolchain friction while preserving real relational SQL schemas matching all 14 entities in Section 10 of the specification.
  - *Alternatives Considered*: In-memory mock arrays (loses relational integrity and restart persistence) or mandatory external Postgres setup before first run (adds setup friction).

- **Decision 3 — Deterministic Agronomic Optimizer in TypeScript (Zero LLM Math)**
  - *Chosen Approach*: Implement the ICAR district crop nutrient lookup table, FCO 1985 product composition matrix, and constrained multi-nutrient fertilizer solver directly in deterministic TypeScript services. Account for nitrogen supplied by DAP (`18% N`) before calculating remaining Urea (`46% N`), compute P2O5 via DAP/SSP and K2O via MOP (`60% K2O`), convert `kg/ha` to farm area, and estimate costs from transparent unit prices.
  - *Why*: Eliminates dangerous dosage hallucinations, satisfies Section 8 & 17 safety requirements, and enables full unit testing and audit trails.
  - *Alternatives Considered*: Prompting Gemini to compute fertilizer doses — strictly forbidden by the specification.

- **Decision 4 — Serverless-Safe PDF Generation (`pdfkit`) & Multimodal Gemini Extraction**
  - *Chosen Approach*: Use pure-Node `pdfkit` to stream structured, multi-section Soil Health & Fertilizer Advisory PDFs directly from `/api/v1/reports/:id/download`. Use `gemini-4-hydrogen` multimodal inline input for PDF/image soil health card extraction into a strict JSON schema (`responseSchema`).
  - *Why*: Headless Chrome/Puppeteer exceeds Vercel serverless size limits and adds heavy memory overhead; `pdfkit` is lightweight, fast, and deterministic.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System & Component Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     REACT SPA FRONTEND (Vite + Tailwind)                   │
│                                                                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │ Public Views │  │ Workspace Shell  │  │ Core Agronomic & AI Modules  │  │
│  │ • Landing    │  │ • Sidebar Nav    │  │ • Dashboard & Weather Card   │  │
│  │ • Auth/Demo  │  │ • Context Header │  │ • Farm CRUD & Area Converter │  │
│  └──────┬───────┘  │ • Language Pref  │  │ • Soil Manual / Card Upload  │  │
│         │          └────────┬─────────┘  │ • Soil Results + Charts      │  │
│         │                   │            │ • Fertilizer Optimizer View  │  │
│         └───────────────────┴────────────┤ • Multilingual RAG Chat      │  │
│                                          │ • History, Reports & PDF DL  │  │
│                                          │ • Profile & Dataset Registry │  │
│                                          └──────────────┬───────────────┘  │
└─────────────────────────────────────────────────────────┼──────────────────┘
                                                          │ HTTP / JWT Bearer
                                                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 UNIFIED EXPRESS.JS BACKEND (/api/v1/*)                     │
│      (Mounted in Node Server for Render/Dev & Exported for Vercel)         │
│                                                                            │
│  ┌─────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐  │
│  │ Auth & Access Layer │  │ Core API Routers   │  │ Deployment Adapters │  │
│  │ • JWT Access/Refresh│  │ • /auth  /farms    │  │ • Standalone Server │  │
│  │ • Scrypt Hashing    │  │ • /crops /soil     │  │   (Render / Dev)    │  │
│  │ • Owner Guards      │  │ • /fertilizer      │  │ • Serverless Entry  │  │
│  └──────────┬──────────┘  │ • /assistant       │  │   (Vercel /api)     │  │
│             │             │ • /reports /weather│  └─────────────────────┘  │
│             │             │ • /datasets        │                           │
│             │             └─────────┬──────────┘                           │
│             ▼                       ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    REUSABLE SERVICE LAYER                            │  │
│  │                                                                      │  │
│  │  ┌─────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │  │
│  │  │ Soil Rule Engine│  │ Fertilizer Optimizer │  │ Document & PDF  │  │  │
│  │  │ • 13-Param Check│  │ • ICAR District Rules│  │ • Gemini OCR    │  │  │
│  │  │ • Unit Integrity│  │ • FCO 1985 Grades    │  │   Extraction    │  │  │
│  │  │ • KA Benchmarks │  │ • Multi-Nutrient Math│  │ • PDFKit Report │  │  │
│  │  └─────────────────┘  │ • Safety Guardrails  │  │   Streaming     │  │  │
│  │                       └──────────────────────┘  └─────────────────┘  │  │
│  │  ┌─────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │  │
│  │  │ RAG Knowledge   │  │ AI Explanation Svc   │  │ Data Foundation │  │  │
│  │  │ • ICAR & FCO KB │  │ • Gemini 4 Hydrogen  │  │ • Registry &    │  │  │
│  │  │ • BM25 / Keyword│  │ • Optional NVIDIA    │  │   Dictionary    │  │  │
│  │  │   Citation Match│  │   NIM Fallback       │  │ • KA Validator  │  │  │
│  │  └─────────────────┘  └──────────────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │        RELATIONAL PERSISTENCE LAYER (SQLite / Postgres-Ready)        │  │
│  │  Users · Profiles · Farms · Crops · SoilSamples · SoilMeasurements   │  │
│  │  SoilAnalyses · CropNutrientStandards · FertilizerProducts           │  │
│  │  FertilizerRecommendations · LineItems · ChatSessions/Messages       │  │
│  │  Reports                                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Dataset Foundation

- **Relational Schema (14 Core Entities)**: Models every entity from Section 10 of the specification — `User`, `FarmerProfile`, `Farm`, `Crop`, `SoilSample` (preserving `lab_name`, `sample_depth`, `extraction_method`, `verification_status`, and duplicate-prevention fingerprint), `SoilMeasurement` (storing `measured_value`, original `unit`, and `method` without silent conversion), `SoilAnalysis`, `CropNutrientStandard` (seeded with verified Karnataka ICAR district standards for Rice, Wheat, Sugarcane, Kharif Maize, and Rabi Maize), `FertilizerProduct` (seeded with FCO 1985 specs: Urea, DAP, MOP, SSP, Zinc Sulphate, Gypsum), `FertilizerRecommendation`, `FertilizerLineItem`, `ChatSession`, `ChatMessage`, and `Report`.
- **Dataset Governance Foundation**: Establishes the dedicated dataset registry (recording Datasets A–F names, source URLs, license/verification status, regional coverage, fields, and strict intended-use boundaries), data dictionary, Karnataka soil validation & preprocessing script (checking missing values, duplicates, unit consistency, and physiological outlier bounds), and seeded Karnataka district soil baseline profiles for regional comparison charts.

### Interactive Component & State Mapping

- **Auth Context**: Holds JWT access/refresh tokens, authenticated user profile, preferred language, and automatic token refresh on `401` responses; enforces protected routes and user-scoped data ownership on every API request.
- **Farm & Active Context Store**: Manages the farmer's farm list, active selected farm, and live CRUD mutations (create/update/delete farm) so soil uploads, fertilizer calculations, weather checks, and AI chat automatically pre-populate the selected farm context.
- **Soil Intake & Verification Flow**: Validates all 13 numeric inputs client- and server-side with realistic agronomic bounds (e.g., pH `3.0–10.5`, non-negative nutrient values); transitions seamlessly from upload → Gemini multimodal extraction → editable verification table → saved verified analysis → Soil Results view with interactive Recharts visualizations.
- **Fertilizer Calculation & Safety Flow**: Submits verified soil analysis + crop/season/area to the deterministic optimizer; updates line items, total bags, INR cost, and split application schedule reactively; renders explicit "Agricultural Expert Review Needed" state whenever no validated regional ICAR rule matches.
- **Multilingual RAG Chat**: Persists chat sessions and messages in SQLite, streams or returns grounded answers with clickable retrieved source cards, switches response language dynamically (`en`, `kn`, `ta`, `te`, `hi`), and surfaces clear error messages if the upstream AI provider fails without fabricating fake responses.
- **Report & PDF Download Lifecycle**: Generates saved report audit records linked to specific analysis + recommendation IDs and triggers direct browser download of the server-generated PDF from `/api/v1/reports/:id/download`.

### Key Sequences & Integrations

- **Gemini AI Integration (`@google/genai`)**: Server-side singleton initialized with `process.env.GEMINI_API_KEY` and required `User-Agent: aistudio-build` header, using `gemini-4-hydrogen` for:
  1. Structured JSON extraction (`responseSchema`) of soil test PDFs/images.
  2. Grounded multilingual explanations & agricultural Q&A fed with the farmer's verified soil/fertilizer records and retrieved ICAR/FCO knowledge-base chunks.
- **Optional NVIDIA NIM Fallback**: If `process.env.NVIDIA_API_KEY` is present and a Gemini explanation call encounters a transient upstream error, the text explanation service can route to NVIDIA's OpenAI-compatible inference endpoint while preserving the exact same RAG grounding prompt and citation contract.
- **Optional Weather Advisory**: Calls Open-Meteo using the selected Karnataka district's coordinates to display current conditions, 3-day rainfall risk, and fertilizer application timing advice (strictly non-blocking; soil and fertilizer workflows succeed even if weather is offline).
- **Automated Verification**: Includes backend test scripts validating auth/permissions, soil input validation, Karnataka preprocessing checks, deterministic fertilizer math & DAP nitrogen credit accounting, safety fallback for unsupported crops, and PDF report generation.
