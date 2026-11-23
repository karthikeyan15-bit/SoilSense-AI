import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  Farm,
  FertilizerRecommendationRecord,
  KarnatakaDistrictProfile,
  ReportRecord,
  SoilAnalysisRecord,
  SupportedLanguage,
  UserProfile,
} from '../../shared/types';
import {
  api,
  clearAuthTokens,
  getStoredAccessToken,
  setAuthTokens,
  type SupportedCropInfo,
} from '../services/api';

export type AppPage =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'farms'
  | 'soil-analysis'
  | 'soil-results'
  | 'fertilizer'
  | 'assistant'
  | 'reports'
  | 'profile';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  page: AppPage;
  setPage: (p: AppPage) => void;
  user: UserProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  farms: Farm[];
  activeFarmId: string | null;
  setActiveFarmId: (id: string | null) => void;
  activeFarm: Farm | null;
  analyses: SoilAnalysisRecord[];
  selectedAnalysisId: string | null;
  setSelectedAnalysisId: (id: string | null) => void;
  recommendations: FertilizerRecommendationRecord[];
  selectedRecommendationId: string | null;
  setSelectedRecommendationId: (id: string | null) => void;
  reports: ReportRecord[];
  crops: SupportedCropInfo[];
  states: string[];
  districts: KarnatakaDistrictProfile[];
  toast: ToastMessage | null;
  notify: (type: ToastMessage['type'], message: string) => void;
  dismissToast: () => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  registerAccount: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    preferredLanguage: SupportedLanguage;
  }) => Promise<void>;
  loginDemoFarmer: () => Promise<void>;
  logout: () => void;
  refreshWorkspaceData: () => Promise<void>;
  updateUserProfile: (patch: { name?: string; phone?: string; preferredLanguage?: SupportedLanguage }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState<AppPage>('landing');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<SoilAnalysisRecord[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<FertilizerRecommendationRecord[]>([]);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);

  const [crops, setCrops] = useState<SupportedCropInfo[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<KarnatakaDistrictProfile[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback((type: ToastMessage['type'], message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadCatalog = useCallback(async () => {
    try {
      const cat = await api.getCropsCatalog();
      setCrops(cat.crops);
      setStates(cat.states ?? []);
      setDistricts(cat.districts);
    } catch {
      // Non-fatal on initial load
    }
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [farmRes, soilRes, recRes, repRes] = await Promise.all([
        api.listFarms(),
        api.getSoilHistory(),
        api.listRecommendations(),
        api.listReports(),
      ]);
      setFarms(farmRes.farms);
      setAnalyses(soilRes.analyses);
      setRecommendations(recRes.recommendations);
      setReports(repRes.reports);

      setActiveFarmId((prev) => {
        if (prev && farmRes.farms.some((f) => f.id === prev)) return prev;
        return farmRes.farms[0]?.id ?? null;
      });
      setSelectedAnalysisId((prev) => {
        if (prev && soilRes.analyses.some((a) => a.id === prev)) return prev;
        return soilRes.analyses[0]?.id ?? null;
      });
      setSelectedRecommendationId((prev) => {
        if (prev && recRes.recommendations.some((r) => r.id === prev)) return prev;
        return recRes.recommendations[0]?.id ?? null;
      });
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load workspace records.');
    } finally {
      setDataLoading(false);
    }
  }, [notify]);

  // Bootstrap session if token exists
  useEffect(() => {
    loadCatalog();
    const token = getStoredAccessToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api
      .getProfile()
      .then(async (res) => {
        setUser(res.user);
        setPage('dashboard');
        await refreshWorkspaceData();
      })
      .catch(() => {
        clearAuthTokens();
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [loadCatalog, refreshWorkspaceData]);

  const loginWithCredentials = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    await refreshWorkspaceData();
    setPage('dashboard');
    notify('success', `Welcome back, ${res.user.name}.`);
  };

  const registerAccount = async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    preferredLanguage: SupportedLanguage;
  }) => {
    const res = await api.register(input);
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    await refreshWorkspaceData();
    setPage('farms');
    notify('success', `Account created for ${res.user.name}. Register your first farm to begin.`);
  };

  const loginDemoFarmer = async () => {
    const res = await api.demoLogin();
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    await refreshWorkspaceData();
    setPage('dashboard');
    notify('success', 'Signed in to the All-India Demo Farmer profile (Punjab, Karnataka & Maharashtra plots).');
  };

  const logout = () => {
    clearAuthTokens();
    setUser(null);
    setFarms([]);
    setAnalyses([]);
    setRecommendations([]);
    setReports([]);
    setActiveFarmId(null);
    setPage('landing');
    notify('info', 'Signed out of SoilSense AI.');
  };

  const updateUserProfile = async (patch: {
    name?: string;
    phone?: string;
    preferredLanguage?: SupportedLanguage;
  }) => {
    const res = await api.updateProfile(patch);
    setUser(res.user);
    notify('success', 'Farmer profile preferences saved.');
  };

  const activeFarm = farms.find((f) => f.id === activeFarmId) ?? farms[0] ?? null;

  return (
    <AppContext.Provider
      value={{
        page,
        setPage,
        user,
        authLoading,
        dataLoading,
        farms,
        activeFarmId,
        setActiveFarmId,
        activeFarm,
        analyses,
        selectedAnalysisId,
        setSelectedAnalysisId,
        recommendations,
        selectedRecommendationId,
        setSelectedRecommendationId,
        reports,
        crops,
        states,
        districts,
        toast,
        notify,
        dismissToast,
        loginWithCredentials,
        registerAccount,
        loginDemoFarmer,
        logout,
        refreshWorkspaceData,
        updateUserProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
