import type {
  AreaUnit,
  ChatMessageRecord,
  ChatSessionRecord,
  CropSeason,
  CropSuitabilityResult,
  DatasetRegistryEntry,
  Farm,
  FertilizerRecommendationRecord,
  GrowthStage,
  KarnatakaDistrictProfile,
  ReportRecord,
  SoilAnalysisRecord,
  SoilMeasurementInput,
  SupportedLanguage,
  UserProfile,
  WeatherAdvisoryResponse,
} from '../../shared/types';

const ACCESS_KEY = 'soilsense_access_token';
const REFRESH_KEY = 'soilsense_refresh_token';

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearAuthTokens();
      return null;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setAuthTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getStoredAccessToken();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && localStorage.getItem(REFRESH_KEY)) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface SupportedCropInfo {
  id: string;
  cropName: string;
  seasons: CropSeason[];
  icarSupported: boolean;
  notes: string;
}

export interface ExtractedSoilPayload {
  uploadedFileName: string;
  extracted: {
    labName: string;
    sampleDate: string;
    sampleDepth: string;
    extractionMethod: string;
    confidenceNotes: string;
    measurements: SoilMeasurementInput[];
  };
}

export interface KarnatakaDatasetSummaryResponse {
  registry: DatasetRegistryEntry[];
  states?: string[];
  districts: KarnatakaDistrictProfile[];
  qualitySummary: {
    sourceFile: string;
    processedAt: string;
    totalRawRows: number;
    validCleanedRows: number;
    duplicateRowsRemoved: number;
    outlierRowsFlagged: number;
    missingValueCounts: Record<string, number>;
    unitConsistencyVerified: boolean;
    districtsCovered: string[];
    statesCovered?: string[];
    anomalies: Array<{ rowNumber: number; state?: string; district: string; village: string; reason: string }>;
  } | null;
}

export const api = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    preferredLanguage: SupportedLanguage;
  }) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  demoLogin: () => apiRequest<AuthResponse>('/auth/demo', { method: 'POST' }),

  getProfile: () => apiRequest<{ user: UserProfile }>('/auth/profile'),

  updateProfile: (body: { name?: string; phone?: string; preferredLanguage?: SupportedLanguage }) =>
    apiRequest<{ user: UserProfile }>('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),

  getCropsCatalog: () =>
    apiRequest<{
      crops: SupportedCropInfo[];
      states: string[];
      districts: KarnatakaDistrictProfile[];
    }>('/crops'),

  listFarms: () => apiRequest<{ farms: Farm[] }>('/farms'),

  createFarm: (body: {
    farmName: string;
    state: string;
    district: string;
    village: string;
    latitude?: number | null;
    longitude?: number | null;
    landArea: number;
    areaUnit: AreaUnit;
    selectedCrop: string;
    cropSeason: CropSeason;
    growthStage: GrowthStage;
    soilType?: string;
  }) => apiRequest<{ farm: Farm }>('/farms', { method: 'POST', body: JSON.stringify(body) }),

  updateFarm: (
    id: string,
    body: {
      farmName: string;
      state: string;
      district: string;
      village: string;
      latitude?: number | null;
      longitude?: number | null;
      landArea: number;
      areaUnit: AreaUnit;
      selectedCrop: string;
      cropSeason: CropSeason;
      growthStage: GrowthStage;
      soilType?: string;
    },
  ) => apiRequest<{ farm: Farm }>(`/farms/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteFarm: (id: string) => apiRequest<{ deleted: boolean }>(`/farms/${id}`, { method: 'DELETE' }),

  uploadSoilReport: (file: File) => {
    const form = new FormData();
    form.append('report', file);
    return apiRequest<ExtractedSoilPayload>('/soil/upload', { method: 'POST', body: form });
  },

  analyzeSoil: (body: {
    farmId: string;
    crop?: string;
    sampleDate: string;
    sampleDepth: string;
    labName: string;
    extractionMethod: string;
    uploadedReportName?: string;
    allowDuplicate?: boolean;
    measurements: SoilMeasurementInput[];
  }) => apiRequest<{ analysis: SoilAnalysisRecord }>('/soil/analyze', { method: 'POST', body: JSON.stringify(body) }),

  getSoilHistory: (farmId?: string) =>
    apiRequest<{ analyses: SoilAnalysisRecord[] }>(farmId ? `/soil/history?farmId=${encodeURIComponent(farmId)}` : '/soil/history'),

  generateFertilizer: (body: {
    soilAnalysisId: string;
    crop?: string;
    season?: CropSeason;
    growthStage?: GrowthStage;
    preferredPSource?: 'auto' | 'DAP' | 'SSP';
    includeZincIfDeficient?: boolean;
  }) =>
    apiRequest<{ recommendation: FertilizerRecommendationRecord }>('/fertilizer/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listRecommendations: () =>
    apiRequest<{ recommendations: FertilizerRecommendationRecord[] }>('/fertilizer'),

  evaluateCropSuitability: (body: {
    nitrogenKgHa: number;
    phosphorusKgHa: number;
    potassiumKgHa: number;
    ph: number;
    temperatureC: number;
    humidityPct: number;
    rainfallMm: number;
  }) =>
    apiRequest<{ recommendations: CropSuitabilityResult[] }>('/crops/recommend', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listChatSessions: () => apiRequest<{ sessions: ChatSessionRecord[] }>('/assistant/sessions'),

  sendAssistantMessage: (body: {
    question: string;
    language: SupportedLanguage;
    sessionId?: string;
    farmId?: string;
    soilAnalysisId?: string;
    recommendationId?: string;
  }) =>
    apiRequest<{ sessionId: string; message: ChatMessageRecord }>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generateReport: (body: {
    soilAnalysisId: string;
    recommendationId?: string | null;
    reportTitle?: string;
  }) => apiRequest<{ report: ReportRecord }>('/reports/generate', { method: 'POST', body: JSON.stringify(body) }),

  listReports: () => apiRequest<{ reports: ReportRecord[] }>('/reports'),

  getReportDownloadUrl: (reportId: string) => {
    const token = getStoredAccessToken() ?? '';
    return `/api/v1/reports/${encodeURIComponent(reportId)}/download?token=${encodeURIComponent(token)}`;
  },

  getWeather: (district: string, lat?: number | null, lon?: number | null, state?: string | null) => {
    const params = new URLSearchParams({ district });
    if (state) params.set('state', state);
    if (typeof lat === 'number') params.set('lat', String(lat));
    if (typeof lon === 'number') params.set('lon', String(lon));
    return apiRequest<{ weather: WeatherAdvisoryResponse }>(`/weather?${params.toString()}`);
  },

  getKarnatakaDatasetSummary: () =>
    apiRequest<KarnatakaDatasetSummaryResponse>('/datasets/india-summary'),
};
