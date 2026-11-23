# SoilSense AI

Multilingual AI-powered agriculture decision-support platform for farmers across India with deterministic ICAR/FCO fertilizer optimization, soil analysis, and all-India regional baselines.

## Overview

SoilSense AI helps farmers analyze soil health, compute verified fertilizer plans, and receive multilingual agronomic guidance in English, Hindi, Kannada, Tamil, and Telugu. The platform combines:

- **Soil analysis** — lab report ingestion, parameter measurement, and nutrient status computation
- **Fertilizer recommendations** — ICAR crop nutrient standards and FCO 1985 fertilizer product calculations
- **AI assistant** — multilingual RAG-based agronomic chat with source references
- **Farm management** — multi-farm profiles, crop selection, growth-stage tracking
- **Reports** — downloadable PDF soil health and fertilizer recommendation reports

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion, Recharts
- **Backend:** Node.js, Express, tsx
- **Database:** Built-in SQLite (sql.js — zero-config, no `DATABASE_URL` needed)
- **AI:** Google Gemini (`@google/genai`), optional NVIDIA NIM fallback
- **Auth:** JWT-based authentication with password hashing (scrypt)
- **PDF:** pdfkit for report generation

## Project Structure

```
soilsense-ai/
├── server.ts              # Unified Express + Vite dev server entry point
├── vite.config.ts         # Vite build configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variable template
├── vercel.json            # Vercel deployment config
├── render.yaml            # Render deployment config
├── api/
│   └── index.ts           # Vercel serverless API handler
├── backend/
│   ├── app.ts             # Express app factory (routes + middleware)
│   ├── data/
│   │   ├── agronomicData.ts      # ICAR crop nutrient standards, FCO fertilizer products
│   │   └── knowledgeBase.ts      # RAG knowledge base for AI assistant
│   ├── db/
│   │   └── database.ts           # SQLite (sql.js) schema, seeding, queries
│   ├── middleware/
│   │   └── auth.ts               # JWT authentication middleware
│   ├── services/
│   │   ├── aiService.ts          # Gemini/NVIDIA AI provider
│   │   ├── datasetPreprocessor.ts# Soil data cleaning pipeline
│   │   ├── fertilizerService.ts  # Fertilizer calculation logic
│   │   ├── reportService.ts      # PDF report generation
│   │   ├── soilService.ts        # Soil analysis service
│   │   └── weatherService.ts     # Weather data integration
│   └── tests/
│       └── runTests.ts           # Backend test suite
├── data/
│   ├── metadata/               # Data dictionary, dataset registry, preprocessing log
│   ├── processed/              # Cleaned CSVs, SQLite DB, quality summary
│   └── raw/                    # Raw soil health samples (India, Karnataka)
├── public/
│   └── assets/aistudio/        # AI Studio project specification PDF
└── src/
    ├── main.tsx                # React entry point
    ├── App.tsx                 # Root app with routing
    ├── index.css               # Tailwind styles
    ├── components/
    │   └── WorkspaceShell.tsx  # App shell layout
    ├── context/
    │   └── AppContext.tsx      # Auth + global state context
    ├── pages/
    │   ├── AiAssistantPage.tsx
    │   ├── AuthPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── FarmManagementPage.tsx
    │   ├── FertilizerRecommendationPage.tsx
    │   ├── HistoryReportsPage.tsx
    │   ├── LandingPage.tsx
    │   ├── ProfileSettingsPage.tsx
    │   ├── SoilAnalysisPage.tsx
    │   └── SoilResultsPage.tsx
    ├── services/
    │   └── api.ts                # Frontend API client
    └── assets/images/          # Editorial images
```

## Run Locally

### Prerequisites

- Node.js (v18+ recommended)
- A Gemini API key (from [Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/karthikeyan15-bit/soilsense-ai.git
cd soilsense-ai

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

# Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with Vite HMR |
| `npm start` | Run production server (`node server.ts`) |
| `npm run build` | Build frontend for production (`vite build`) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm run test:backend` | Run backend test suite |
| `npm run clean` | Remove `dist/` and `server.js` |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Primary Gemini API key for AI features | Yes |
| `NVIDIA_API_KEY` | Optional NVIDIA NIM fallback API key | No |
| `NVIDIA_MODEL` | NVIDIA model name (default: `meta/llama-3.1-70b-instruct`) | No |
| `APP_URL` | Public URL of the app (default: `http://localhost:3000`) | No |
| `PORT` | Server port (default: `3000`) | No |

JWT secrets and the SQLite database are auto-configured — no manual setup needed.

## Demo Credentials

A demo farmer account is seeded on first run:

- **Email:** `demo@soilsense.in`
- **Password:** `Farmer@2026`

## Deployment

### Vercel

```bash
vercel
```

Set `GEMINI_API_KEY` in Vercel project settings. The `api/index.ts` handler serves as the serverless entry point.

### Render

```bash
# Render deploys using render.yaml configuration
```

Set `GEMINI_API_KEY` in Render environment variables.

## Features

### Soil Analysis
- Upload and parse soil lab reports
- Store measurements (N, P, K, pH, organic carbon, etc.)
- Compute nutrient status vs. ICAR standards
- Track deficiencies and excesses

### Fertilizer Recommendations
- Deterministic calculations based on ICAR crop nutrient standards
- FCO 1985 compliant fertilizer products (urea, DAP, MOP, etc.)
- Per-hectare and total quantity calculations
- Estimated cost in INR
- Application schedule with warnings

### AI Assistant
- Multilingual support (English, Hindi, Kannada, Tamil, Telugu)
- RAG-based responses with source references
- Chat session history

### Farm Management
- Multiple farm profiles per user
- Crop, season, and growth-stage tracking
- Location (state, district, village) and area tracking

### Reports
- PDF soil health reports
- PDF fertilizer recommendation reports
- Report history and download

## Database

The app uses a zero-config SQLite database (via `sql.js`) stored at `data/processed/soilsense.sqlite`. The schema is auto-created on first run and includes:

- `users`, `farmer_profiles` — authentication and profiles
- `farms` — farm profiles
- `crops`, `crop_nutrient_standards` — ICAR reference data
- `fertilizer_products` — FCO 1985 products
- `soil_samples`, `soil_measurements` — soil test data
- `soil_analyses` — computed nutrient status
- `fertilizer_recommendations`, `fertilizer_line_items` — fertilizer plans
- `chat_sessions`, `chat_messages` — AI chat history
- `reports` — generated reports

Demo data (farms in Punjab, Karnataka, and Maharashtra) is seeded automatically.

## License

Private project — SoilSense AI.
