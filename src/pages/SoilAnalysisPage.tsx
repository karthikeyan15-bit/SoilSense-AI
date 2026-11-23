import React, { useState } from 'react';
import { CheckCircle2, FileUp, FlaskConical, Upload } from 'lucide-react';
import type { SoilMeasurementInput } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface ParamConfig {
  key: SoilMeasurementInput['parameterName'];
  label: string;
  units: string[];
  defaultUnit: string;
  placeholder: string;
  methodDefault: string;
}

const PARAMETER_CONFIGS: ParamConfig[] = [
  { key: 'pH', label: 'Soil pH', units: ['pH'], defaultUnit: 'pH', placeholder: '6.9', methodDefault: '1:2.5 soil-water' },
  { key: 'EC', label: 'Electrical Conductivity (EC)', units: ['dS/m'], defaultUnit: 'dS/m', placeholder: '0.45', methodDefault: 'Conductivity meter' },
  { key: 'OrganicCarbon', label: 'Organic Carbon (OC)', units: ['%'], defaultUnit: '%', placeholder: '0.54', methodDefault: 'Walkley-Black' },
  { key: 'Nitrogen', label: 'Available Nitrogen (N)', units: ['kg/ha', 'mg/kg', 'ppm', 'kg/acre'], defaultUnit: 'kg/ha', placeholder: '240', methodDefault: 'Alkaline KMnO4' },
  { key: 'Phosphorus', label: 'Available Phosphorus (P)', units: ['kg/ha', 'mg/kg', 'ppm', 'kg/acre'], defaultUnit: 'kg/ha', placeholder: '17.5', methodDefault: 'Olsen / Bray' },
  { key: 'Potassium', label: 'Available Potassium (K)', units: ['kg/ha', 'mg/kg', 'ppm', 'kg/acre'], defaultUnit: 'kg/ha', placeholder: '265', methodDefault: 'Neutral NH4OAc' },
  { key: 'Sulphur', label: 'Available Sulphur (S)', units: ['ppm', 'mg/kg', 'kg/ha'], defaultUnit: 'ppm', placeholder: '11.2', methodDefault: '0.15% CaCl2' },
  { key: 'Zinc', label: 'DTPA Zinc (Zn)', units: ['ppm', 'mg/kg'], defaultUnit: 'ppm', placeholder: '0.52', methodDefault: 'DTPA Extract' },
  { key: 'Iron', label: 'DTPA Iron (Fe)', units: ['ppm', 'mg/kg'], defaultUnit: 'ppm', placeholder: '9.8', methodDefault: 'DTPA Extract' },
  { key: 'Boron', label: 'Hot-Water Boron (B)', units: ['ppm', 'mg/kg'], defaultUnit: 'ppm', placeholder: '0.55', methodDefault: 'Hot-Water Soluble' },
  { key: 'Copper', label: 'DTPA Copper (Cu)', units: ['ppm', 'mg/kg'], defaultUnit: 'ppm', placeholder: '1.1', methodDefault: 'DTPA Extract' },
  { key: 'Manganese', label: 'DTPA Manganese (Mn)', units: ['ppm', 'mg/kg'], defaultUnit: 'ppm', placeholder: '7.8', methodDefault: 'DTPA Extract' },
  { key: 'Moisture', label: 'Soil Moisture (Optional)', units: ['%'], defaultUnit: '%', placeholder: '22', methodDefault: 'Gravimetric' },
];

type RowState = Record<string, { value: string; unit: string; method: string }>;

function buildEmptyRows(): RowState {
  const state: RowState = {};
  for (const p of PARAMETER_CONFIGS) {
    state[p.key] = { value: '', unit: p.defaultUnit, method: p.methodDefault };
  }
  return state;
}

export function SoilAnalysisPage() {
  const {
    farms,
    activeFarm,
    crops,
    refreshWorkspaceData,
    setSelectedAnalysisId,
    setPage,
    notify,
  } = useApp();

  const [mode, setMode] = useState<'manual' | 'upload'>('manual');
  const [selectedFarmId, setSelectedFarmId] = useState<string>(activeFarm?.id ?? farms[0]?.id ?? '');
  const [crop, setCrop] = useState<string>(activeFarm?.selectedCrop ?? 'Rice');
  const [sampleDate, setSampleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sampleDepth, setSampleDepth] = useState<string>('0–15 cm');
  const [labName, setLabName] = useState<string>('District Soil Health Laboratory (SHC)');
  const [extractionMethod, setExtractionMethod] = useState<string>('ICAR Soil Health Card Protocol');
  const [uploadedReportName, setUploadedReportName] = useState<string | undefined>(undefined);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState>(buildEmptyRows);

  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (key: string, field: 'value' | 'unit' | 'method', val: string) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const applySamplePreset = (preset: 'ludhiana_wheat' | 'mandya_paddy' | 'kolhapur_black' | 'jorhat_acidic') => {
    const next = buildEmptyRows();
    const sets: Record<string, Record<string, number>> = {
      ludhiana_wheat: {
        pH: 7.7, EC: 0.42, OrganicCarbon: 0.43, Nitrogen: 218, Phosphorus: 17.2, Potassium: 288,
        Sulphur: 10.6, Zinc: 0.51, Iron: 7.4, Boron: 0.64, Copper: 1.15, Manganese: 5.8, Moisture: 18,
      },
      mandya_paddy: {
        pH: 7.0, EC: 0.43, OrganicCarbon: 0.45, Nitrogen: 215, Phosphorus: 14.5, Potassium: 242,
        Sulphur: 8.8, Zinc: 0.46, Iron: 10.2, Boron: 0.54, Copper: 1.05, Manganese: 7.9, Moisture: 26,
      },
      kolhapur_black: {
        pH: 8.1, EC: 0.78, OrganicCarbon: 0.54, Nitrogen: 228, Phosphorus: 15.8, Potassium: 392,
        Sulphur: 14.2, Zinc: 0.42, Iron: 4.1, Boron: 0.68, Copper: 1.32, Manganese: 6.4, Moisture: 20,
      },
      jorhat_acidic: {
        pH: 5.3, EC: 0.21, OrganicCarbon: 0.92, Nitrogen: 325, Phosphorus: 9.2, Potassium: 178,
        Sulphur: 10.1, Zinc: 0.68, Iron: 28.0, Boron: 0.36, Copper: 1.4, Manganese: 15.2, Moisture: 30,
      },
    };
    for (const [k, v] of Object.entries(sets[preset])) {
      next[k].value = String(v);
    }
    setRows(next);
    setExtractionNote('Sample Indian Soil Health Card preset loaded. Verify or adjust any values before saving.');
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const res = await api.uploadSoilReport(file);
      setUploadedReportName(res.uploadedFileName);
      setLabName(res.extracted.labName || labName);
      if (res.extracted.sampleDate) setSampleDate(res.extracted.sampleDate);
      if (res.extracted.sampleDepth) setSampleDepth(res.extracted.sampleDepth);
      if (res.extracted.extractionMethod) setExtractionMethod(res.extracted.extractionMethod);
      setExtractionNote(res.extracted.confidenceNotes);

      const next = buildEmptyRows();
      for (const m of res.extracted.measurements) {
        if (next[m.parameterName] && m.measuredValue !== null) {
          next[m.parameterName] = {
            value: String(m.measuredValue),
            unit: m.unit || next[m.parameterName].unit,
            method: m.method || next[m.parameterName].method,
          };
        }
      }
      setRows(next);
      notify(
        'success',
        `Extracted ${res.extracted.measurements.length} parameters from ${res.uploadedFileName}. Please verify and correct before saving.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Report extraction failed.';
      setError(msg);
      notify('error', msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      setError('Please register and select a farm first.');
      return;
    }
    setError(null);
    setSubmitting(true);

    const measurements: SoilMeasurementInput[] = PARAMETER_CONFIGS.map((p) => {
      const raw = rows[p.key].value.trim();
      return {
        parameterName: p.key,
        measuredValue: raw === '' ? null : Number(raw),
        unit: rows[p.key].unit,
        method: rows[p.key].method,
      };
    });

    try {
      const res = await api.analyzeSoil({
        farmId: selectedFarmId,
        crop,
        sampleDate,
        sampleDepth,
        labName,
        extractionMethod,
        uploadedReportName,
        measurements,
      });
      await refreshWorkspaceData();
      setSelectedAnalysisId(res.analysis.id);
      notify('success', 'Soil sample verified and analyzed against ICAR & All-India regional baselines.');
      setPage('soil-results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Soil analysis failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (farms.length === 0) {
    return (
      <div className="bg-white border border-[#E2DDD3] rounded-xl p-10 text-center">
        <FlaskConical className="w-8 h-8 text-[#1E4631] mx-auto mb-3" />
        <h2 className="font-display text-2xl font-semibold text-[#18231C] mb-2">
          Register a Farm First
        </h2>
        <p className="text-sm text-[#556159] mb-5 max-w-md mx-auto">
          Soil analyses are linked to a specific farm plot, state, and district so SoilSense AI can compare your
          values against All-India regional baselines and ICAR crop rules.
        </p>
        <button
          type="button"
          onClick={() => setPage('farms')}
          className="h-10 px-5 rounded-lg bg-[#1E4631] text-white text-sm font-semibold"
        >
          Go to Farm Management
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#18231C]">
            Soil Report Intake &amp; Verification
          </h2>
          <p className="text-sm text-[#556159]">
            Enter Soil Health Card readings manually or upload a PDF/image for Gemini extraction. Original
            units are strictly preserved — <span className="font-mono">mg/kg</span> is never silently
            treated as <span className="font-mono">kg/ha</span>.
          </p>
        </div>

        {/* Interactive Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg w-fit shrink-0">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'manual' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
            }`}
          >
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'upload' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
            }`}
          >
            Upload PDF / Image
          </button>
        </div>
      </div>

      {/* Upload Dropzone when Upload Mode active */}
      {mode === 'upload' && (
        <div className="bg-white border border-dashed border-[#B9B0A0] rounded-xl p-6 sm:p-8 text-center">
          <Upload className="w-7 h-7 text-[#1E4631] mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-[#18231C] mb-1">
            Upload Soil Health Card (PDF, JPG, PNG, WebP)
          </h3>
          <p className="text-xs text-[#556159] max-w-lg mx-auto mb-5">
            Gemini multimodal extraction reads printed laboratory values and populates the verification
            ledger below. You can inspect and correct every number before saving.
          </p>
          <label className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold cursor-pointer transition-colors">
            <FileUp className="w-4 h-4" />
            {extracting ? 'Extracting Soil Report...' : 'Choose Soil Report File'}
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={extracting}
              className="hidden"
            />
          </label>
          {uploadedReportName && (
            <p className="text-xs text-[#15803D] mt-3 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Loaded: {uploadedReportName}
            </p>
          )}
        </div>
      )}

      {/* Quick Pan-India Sample Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#556159] font-medium">Quick-fill sample lab card:</span>
        <button
          type="button"
          onClick={() => applySamplePreset('ludhiana_wheat')}
          className="px-3 py-1.5 rounded-md border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] font-medium"
        >
          Ludhiana Alluvial Wheat (PB)
        </button>
        <button
          type="button"
          onClick={() => applySamplePreset('mandya_paddy')}
          className="px-3 py-1.5 rounded-md border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] font-medium"
        >
          Mandya Low-N/S Paddy (KA)
        </button>
        <button
          type="button"
          onClick={() => applySamplePreset('kolhapur_black')}
          className="px-3 py-1.5 rounded-md border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] font-medium"
        >
          Kolhapur Alkaline Black Soil (MH)
        </button>
        <button
          type="button"
          onClick={() => applySamplePreset('jorhat_acidic')}
          className="px-3 py-1.5 rounded-md border border-[#D4CEC2] bg-white hover:bg-[#EFECE6] text-[#18231C] font-medium"
        >
          Jorhat Acidic Alluvial (AS)
        </button>
      </div>

      {extractionNote && (
        <div className="p-4 rounded-lg bg-[#EFECE6]/80 border border-[#D4CEC2] text-xs text-[#18231C]">
          <span className="font-semibold">Verification Note:</span> {extractionNote}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#B91C1C]/30 text-sm text-[#991B1B]">
          {error}
        </div>
      )}

      {/* Farm Metadata & 13-Parameter Editable Verification Ledger */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold text-[#18231C] mb-4">
            1. Sample Metadata &amp; Farm Link
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Farm Plot</label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedFarmId(id);
                  const f = farms.find((item) => item.id === id);
                  if (f) setCrop(f.selectedCrop);
                }}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName} ({f.district}, {f.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Target Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              >
                {crops.map((c) => (
                  <option key={c.id} value={c.cropName}>
                    {c.cropName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Sample Date</label>
              <input
                type="date"
                required
                value={sampleDate}
                onChange={(e) => setSampleDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Lab / Authority Name</label>
              <input
                type="text"
                required
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Sampling Depth</label>
              <input
                type="text"
                value={sampleDepth}
                onChange={(e) => setSampleDepth(e.target.value)}
                placeholder="0–15 cm"
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Extraction Protocol</label>
              <input
                type="text"
                value={extractionMethod}
                onChange={(e) => setExtractionMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2DDD3] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#18231C]">
                2. Verify Soil Parameters &amp; Laboratory Units
              </h3>
              <p className="text-xs text-[#556159]">
                Leave untested parameters blank — SoilSense AI will explicitly list missing parameters rather
                than assuming defaults.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD3] text-left text-xs text-[#556159]">
                  <th className="pb-2.5 pr-4 font-medium">Soil Parameter</th>
                  <th className="pb-2.5 px-2 font-medium w-40">Measured Value</th>
                  <th className="pb-2.5 px-2 font-medium w-32">Reported Unit</th>
                  <th className="pb-2.5 pl-2 font-medium">Lab Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {PARAMETER_CONFIGS.map((p) => (
                  <tr key={p.key} className="hover:bg-[#F8F7F4]/60">
                    <td className="py-2.5 pr-4 font-medium text-[#18231C]">{p.label}</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="any"
                        value={rows[p.key].value}
                        onChange={(e) => updateRow(p.key, 'value', e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full h-9 px-3 rounded-md border border-[#D4CEC2] bg-[#F8F7F4] font-mono tabular-nums text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={rows[p.key].unit}
                        onChange={(e) => updateRow(p.key, 'unit', e.target.value)}
                        className="w-full h-9 px-2 rounded-md border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-xs focus:bg-white focus:border-[#1E4631] focus:outline-none"
                      >
                        {p.units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pl-2">
                      <input
                        type="text"
                        value={rows[p.key].method}
                        onChange={(e) => updateRow(p.key, 'method', e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-[#E2DDD3] bg-transparent text-xs text-[#556159] focus:bg-white focus:text-[#18231C] focus:border-[#1E4631] focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-5 border-t border-[#E2DDD3] flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[#556159]">
              Duplicate submissions with identical date and readings are automatically flagged.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? 'Analyzing Soil Profile...' : 'Verify & Run Soil Analysis'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
