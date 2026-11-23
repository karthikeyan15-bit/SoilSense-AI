import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { AreaUnit, CropSeason, Farm, GrowthStage } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const GROWTH_STAGES: GrowthStage[] = [
  'Pre-sowing / Basal',
  'Vegetative / Tillering',
  'Flowering / Panicle',
  'Grain Filling / Maturity',
];

const SEASONS: CropSeason[] = ['Kharif', 'Rabi', 'Summer', 'Annual'];

export function FarmManagementPage() {
  const {
    farms,
    activeFarmId,
    setActiveFarmId,
    crops,
    states,
    districts,
    refreshWorkspaceData,
    notify,
    setPage,
  } = useApp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(farms.length === 0);
  const [saving, setSaving] = useState(false);

  const [farmName, setFarmName] = useState('');
  const [stateName, setStateName] = useState('Punjab');
  const [district, setDistrict] = useState('Ludhiana');
  const [village, setVillage] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [landArea, setLandArea] = useState('2.5');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('acre');
  const [selectedCrop, setSelectedCrop] = useState('Wheat');
  const [cropSeason, setCropSeason] = useState<CropSeason>('Rabi');
  const [growthStage, setGrowthStage] = useState<GrowthStage>('Pre-sowing / Basal');

  const stateOptions =
    states.length > 0
      ? states
      : [
          'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana',
          'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
          'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
          'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        ];

  const stateDistricts = districts.filter(
    (d) => d.state.toLowerCase() === stateName.toLowerCase(),
  );

  const previewHectares = (() => {
    const num = Number(landArea);
    if (!Number.isFinite(num) || num <= 0) return '0.000';
    if (areaUnit === 'hectare') return num.toFixed(3);
    if (areaUnit === 'acre') return (num * 0.404686).toFixed(3);
    if (areaUnit === 'bigha') return (num * 0.250838).toFixed(3);
    return (num * 0.01011715).toFixed(3);
  })();

  const resetForm = () => {
    setEditingId(null);
    setFarmName('');
    setStateName('Punjab');
    setDistrict('Ludhiana');
    setVillage('');
    setLatitude('');
    setLongitude('');
    setLandArea('2.5');
    setAreaUnit('acre');
    setSelectedCrop('Wheat');
    setCropSeason('Rabi');
    setGrowthStage('Pre-sowing / Basal');
  };

  const openEdit = (farm: Farm) => {
    setEditingId(farm.id);
    setFarmName(farm.farmName);
    setStateName(farm.state);
    setDistrict(farm.district);
    setVillage(farm.village);
    setLatitude(farm.latitude !== null && farm.latitude !== undefined ? String(farm.latitude) : '');
    setLongitude(farm.longitude !== null && farm.longitude !== undefined ? String(farm.longitude) : '');
    setLandArea(String(farm.landArea));
    setAreaUnit(farm.areaUnit);
    setSelectedCrop(farm.selectedCrop);
    setCropSeason(farm.cropSeason);
    setGrowthStage(farm.growthStage);
    setFormOpen(true);
  };

  const handleStateChange = (newState: string) => {
    setStateName(newState);
    const matching = districts.filter((d) => d.state.toLowerCase() === newState.toLowerCase());
    if (matching.length > 0) {
      setDistrict(matching[0].district);
      if (!editingId) {
        setLatitude(String(matching[0].latitude));
        setLongitude(String(matching[0].longitude));
      }
    } else {
      setDistrict('');
      if (!editingId) {
        setLatitude('');
        setLongitude('');
      }
    }
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const match = districts.find(
      (d) => d.district.toLowerCase() === newDistrict.trim().toLowerCase(),
    );
    if (match && !editingId) {
      setLatitude(String(match.latitude));
      setLongitude(String(match.longitude));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const areaNum = Number(landArea);
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      notify('error', 'Land area must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        farmName,
        state: stateName,
        district,
        village,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        landArea: areaNum,
        areaUnit,
        selectedCrop,
        cropSeason,
        growthStage,
      };
      if (editingId) {
        await api.updateFarm(editingId, payload);
        notify('success', `Updated farm "${farmName}".`);
      } else {
        const res = await api.createFarm(payload);
        setActiveFarmId(res.farm.id);
        notify('success', `Registered farm "${farmName}".`);
      }
      await refreshWorkspaceData();
      resetForm();
      setFormOpen(false);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to save farm.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farm: Farm) => {
    try {
      await api.deleteFarm(farm.id);
      await refreshWorkspaceData();
      notify('info', `Deleted farm "${farm.farmName}".`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete farm.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#18231C]">Registered Farm Plots</h2>
          <p className="text-sm text-[#556159]">
            Register farm plots anywhere across India&apos;s 28 States &amp; 8 Union Territories. Store area in
            acres, hectares, bighas, or guntas — automatically normalized for ICAR per-hectare calculations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setFormOpen((v) => !v);
          }}
          className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {formOpen && !editingId ? 'Close Form' : 'Add New Farm'}
        </button>
      </div>

      {/* Create / Edit Farm Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E2DDD3] rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
            <h3 className="font-display text-lg font-semibold text-[#18231C]">
              {editingId ? 'Edit Farm Details' : 'Register New Farm Plot'}
            </h3>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              className="text-xs font-medium text-[#556159] hover:text-[#18231C]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Farm Name</label>
              <input
                type="text"
                required
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g., East Borewell Paddy Plot"
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
                State / Union Territory (All-India)
              </label>
              <select
                value={stateName}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              >
                {stateOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
                District (Select or Type Any District)
              </label>
              <input
                type="text"
                required
                list="india-district-suggestions"
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                placeholder={
                  stateDistricts.length > 0
                    ? `e.g., ${stateDistricts[0].district}`
                    : `Enter district in ${stateName}`
                }
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              />
              <datalist id="india-district-suggestions">
                {stateDistricts.map((d) => (
                  <option key={`${d.state}-${d.district}`} value={d.district}>
                    {d.district} — {d.regionZone}
                  </option>
                ))}
              </datalist>
              {stateDistricts.length > 0 && (
                <p className="text-[11px] text-[#556159] mt-1 truncate">
                  Benchmarked: {stateDistricts.map((d) => d.district).join(', ')} (or enter any)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Village / Tehsil / Block</label>
              <input
                type="text"
                required
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g., Jagraon / Maddur / Karvir"
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
                Land Area &amp; Unit
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  required
                  value={landArea}
                  onChange={(e) => setLandArea(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
                />
                <select
                  value={areaUnit}
                  onChange={(e) => setAreaUnit(e.target.value as AreaUnit)}
                  className="h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
                >
                  <option value="acre">Acres</option>
                  <option value="hectare">Hectares</option>
                  <option value="bigha">Bighas</option>
                  <option value="gunta">Guntas</option>
                </select>
              </div>
              <p className="text-[11px] text-[#556159] mt-1 font-mono tabular-nums">
                Normalized: {previewHectares} hectares
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Selected Crop</label>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              >
                {(crops.length > 0
                  ? crops
                  : [
                      { id: 'r', cropName: 'Rice', icarSupported: true },
                      { id: 's', cropName: 'Sugarcane', icarSupported: true },
                      { id: 'km', cropName: 'Kharif Maize', icarSupported: true },
                      { id: 'rm', cropName: 'Rabi Maize', icarSupported: true },
                      { id: 'w', cropName: 'Wheat', icarSupported: true },
                    ]
                ).map((c) => (
                  <option key={c.id} value={c.cropName}>
                    {c.cropName} {c.icarSupported ? '(ICAR Verified)' : '(Expert Review)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18231C] mb-1.5">Crop Season</label>
              <select
                value={cropSeason}
                onChange={(e) => setCropSeason(e.target.value as CropSeason)}
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
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
                className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:outline-none focus:border-[#1E4631]"
              >
                {GROWTH_STAGES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
                  Latitude (Opt.)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="12.5218"
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1E4631]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#18231C] mb-1.5">
                  Longitude (Opt.)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="76.8951"
                  className="w-full h-10 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1E4631]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save Farm Changes' : 'Save Farm Plot'}
            </button>
          </div>
        </form>
      )}

      {/* Farm List */}
      {farms.length === 0 ? (
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-10 text-center">
          <p className="font-display text-xl text-[#18231C] mb-2">No farms registered yet</p>
          <p className="text-sm text-[#556159] mb-4">
            Register your first farm plot with district, land area, and crop to begin soil testing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {farms.map((farm) => {
            const isActive = farm.id === activeFarmId;
            return (
              <div
                key={farm.id}
                className={`bg-white rounded-xl p-6 border transition-colors ${
                  isActive ? 'border-[#1E4631]' : 'border-[#E2DDD3]'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs text-[#556159]">
                      {farm.village}, {farm.district}, {farm.state}
                      {isActive ? ' · Active Workspace Plot' : ''}
                    </p>
                    <h3 className="font-display text-xl font-semibold text-[#18231C] mt-0.5">
                      {farm.farmName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(farm)}
                      className="p-2 rounded-lg text-[#556159] hover:text-[#18231C] hover:bg-[#EFECE6]"
                      aria-label={`Edit ${farm.farmName}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(farm)}
                      className="p-2 rounded-lg text-[#556159] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                      aria-label={`Delete ${farm.farmName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#EFECE6] text-xs">
                  <div>
                    <p className="text-[#556159]">Land Area</p>
                    <p className="font-mono tabular-nums font-semibold text-[#18231C] mt-0.5">
                      {farm.landArea} {farm.areaUnit}
                    </p>
                    <p className="font-mono tabular-nums text-[11px] text-[#556159]">
                      ({farm.areaHectares} ha)
                    </p>
                  </div>
                  <div>
                    <p className="text-[#556159]">Crop &amp; Season</p>
                    <p className="font-semibold text-[#18231C] mt-0.5">{farm.selectedCrop}</p>
                    <p className="text-[11px] text-[#556159]">{farm.cropSeason}</p>
                  </div>
                  <div>
                    <p className="text-[#556159]">Stage</p>
                    <p className="font-semibold text-[#18231C] mt-0.5 truncate">{farm.growthStage}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFarmId(farm.id)}
                    className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#EFECE6] text-[#18231C]'
                        : 'border border-[#D4CEC2] text-[#18231C] hover:bg-[#F8F7F4]'
                    }`}
                  >
                    {isActive ? 'Selected Plot' : 'Select Plot'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFarmId(farm.id);
                      setPage('soil-analysis');
                    }}
                    className="h-9 px-3.5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-xs font-semibold transition-colors"
                  >
                    Enter Soil Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
