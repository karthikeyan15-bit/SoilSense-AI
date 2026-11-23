import React from 'react';
import { X } from 'lucide-react';
import { WorkspaceShell } from './components/WorkspaceShell';
import { AppProvider, useApp } from './context/AppContext';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { FarmManagementPage } from './pages/FarmManagementPage';
import { FertilizerRecommendationPage } from './pages/FertilizerRecommendationPage';
import { HistoryReportsPage } from './pages/HistoryReportsPage';
import { LandingPage } from './pages/LandingPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { SoilAnalysisPage } from './pages/SoilAnalysisPage';
import { SoilResultsPage } from './pages/SoilResultsPage';

function ToastBanner() {
  const { toast, dismissToast } = useApp();
  if (!toast) return null;

  const tone =
    toast.type === 'error'
      ? 'bg-[#FEF2F2] border-[#B91C1C]/35 text-[#991B1B]'
      : toast.type === 'success'
        ? 'bg-[#F0FDF4] border-[#15803D]/35 text-[#14532D]'
        : 'bg-white border-[#D4CEC2] text-[#18231C]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-lg border shadow-sm flex items-center justify-between gap-3 text-sm ${tone}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={dismissToast}
        className="p-1 rounded hover:bg-black/5 shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function SoilSenseRouter() {
  const { page, user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-semibold text-[#18231C]">SoilSense AI</p>
          <p className="text-sm text-[#556159]">Loading agronomic workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (page === 'auth') return <AuthPage />;
    return <LandingPage />;
  }

  const renderWorkspacePage = () => {
    switch (page) {
      case 'farms':
        return <FarmManagementPage />;
      case 'soil-analysis':
        return <SoilAnalysisPage />;
      case 'soil-results':
        return <SoilResultsPage />;
      case 'fertilizer':
        return <FertilizerRecommendationPage />;
      case 'assistant':
        return <AiAssistantPage />;
      case 'reports':
        return <HistoryReportsPage />;
      case 'profile':
        return <ProfileSettingsPage />;
      case 'dashboard':
      default:
        return <DashboardPage />;
    }
  };

  return <WorkspaceShell>{renderWorkspacePage()}</WorkspaceShell>;
}

export default function App() {
  return (
    <AppProvider>
      <SoilSenseRouter />
      <ToastBanner />
    </AppProvider>
  );
}
