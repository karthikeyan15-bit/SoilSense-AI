import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, ExternalLink, Save } from 'lucide-react';
import type { SupportedLanguage } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api, type KarnatakaDatasetSummaryResponse } from '../services/api';

export function ProfileSettingsPage() {
  const { user, updateUserProfile, notify } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>(
    user?.preferredLanguage ?? 'en',
  );
  const [saving, setSaving] = useState(false);
  const [datasetSummary, setDatasetSummary] = useState<KarnatakaDatasetSummaryResponse | null>(null);

  useEffect(() => {
    api
      .getKarnatakaDatasetSummary()
      .then(setDatasetSummary)
      .catch(() => setDatasetSummary(null));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({ name, phone, preferredLanguage });
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Farmer Profile Settings */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-[#E2DDD3] rounded-xl p-6 max-w-3xl space-y-5"
      >
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#18231C]">
            Farmer Profile &amp; Language Preferences
          </h2>
          <p className="text-sm text-[#556159]">
            Your private farm and soil records are protected by JWT permissions and are never used for
            model training without explicit permission.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email ?? ''}
              className="w-full h-10 px-3 rounded-lg border border-[#E2DDD3] bg-[#EFECE6]/70 text-sm text-[#556159]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98450 00000"
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
              Default AI Explanation Language
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as SupportedLanguage)}
              className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
            >
              <option value="en">English</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="hi">Hindi (हिन्दी)</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Dataset Foundation & All-India Preprocessing Governance */}
      <section className="bg-white border border-[#E2DDD3] rounded-xl p-6 space-y-6">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-[#1E4631] mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-xl font-semibold text-[#18231C]">
              All-India Dataset Registry &amp; National Soil Validation Foundation
            </h3>
            <p className="text-xs text-[#556159] mt-0.5">
              All six national agronomic and benchmark sources remain strictly separated by responsibility,
              license, and measurement unit compatibility across India&apos;s 28 States &amp; 8 UTs.
            </p>
          </div>
        </div>

        {/* Live All-India Preprocessing QA Summary */}
        {datasetSummary?.qualitySummary && (
          <div className="p-4 rounded-lg bg-[#F8F7F4] border border-[#E2DDD3] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#18231C] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                All-India Soil Health QA Check Passed (Original raw CSV preserved)
              </p>
              <span className="font-mono text-[11px] text-[#556159]">
                {datasetSummary.qualitySummary.sourceFile}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
              <div>
                <p className="text-[#556159]">Raw Sample Rows</p>
                <p className="font-mono tabular-nums text-lg font-semibold text-[#18231C]">
                  {datasetSummary.qualitySummary.totalRawRows}
                </p>
              </div>
              <div>
                <p className="text-[#556159]">Cleaned Valid Rows</p>
                <p className="font-mono tabular-nums text-lg font-semibold text-[#15803D]">
                  {datasetSummary.qualitySummary.validCleanedRows}
                </p>
              </div>
              <div>
                <p className="text-[#556159]">States Validated</p>
                <p className="font-mono tabular-nums text-lg font-semibold text-[#1E4631]">
                  {datasetSummary.qualitySummary.statesCovered?.length ?? datasetSummary.qualitySummary.districtsCovered.length}
                </p>
              </div>
              <div>
                <p className="text-[#556159]">Duplicates Removed</p>
                <p className="font-mono tabular-nums text-lg font-semibold text-[#B45309]">
                  {datasetSummary.qualitySummary.duplicateRowsRemoved}
                </p>
              </div>
              <div>
                <p className="text-[#556159]">Outliers Flagged</p>
                <p className="font-mono tabular-nums text-lg font-semibold text-[#B91C1C]">
                  {datasetSummary.qualitySummary.outlierRowsFlagged}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Registry Table */}
        {datasetSummary?.registry && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2DDD3] text-left text-[#556159]">
                  <th className="pb-2.5 pr-4 font-medium">Dataset</th>
                  <th className="pb-2.5 px-3 font-medium">Coverage &amp; License</th>
                  <th className="pb-2.5 px-3 font-medium">Approved Responsibility</th>
                  <th className="pb-2.5 pl-3 font-medium">Prohibited Misuse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {datasetSummary.registry.map((d) => (
                  <tr key={d.datasetId} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#18231C]">
                        {d.datasetId} — {d.name}
                      </p>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#1E4631] hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        {d.sourceOrganization}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-3 text-[#556159]">
                      <p className="text-[#18231C]">{d.coverage}</p>
                      <p className="mt-0.5">{d.licenseStatus}</p>
                    </td>
                    <td className="py-3 px-3 text-[#18231C] leading-relaxed">{d.intendedUse}</td>
                    <td className="py-3 pl-3 text-[#B91C1C] leading-relaxed">{d.prohibitedUse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
