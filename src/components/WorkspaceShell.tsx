import React, { useState } from 'react';
import {
  BarChart3,
  Calculator,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Sprout,
  Tractor,
  X,
} from 'lucide-react';
import { useApp, type AppPage } from '../context/AppContext';

const NAV_ITEMS: Array<{ id: AppPage; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'farms', label: 'Farm Management', icon: Tractor },
  { id: 'soil-analysis', label: 'Soil Analysis', icon: FlaskConical },
  { id: 'soil-results', label: 'Soil Results', icon: BarChart3 },
  { id: 'fertilizer', label: 'Fertilizer Plan', icon: Calculator },
  { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
  { id: 'reports', label: 'History & Reports', icon: FileText },
  { id: 'profile', label: 'Profile & Data', icon: Settings },
];

const PAGE_TITLES: Record<AppPage, string> = {
  landing: 'Overview',
  auth: 'Sign In',
  dashboard: 'Dashboard',
  farms: 'Farm Management',
  'soil-analysis': 'Soil Analysis Intake',
  'soil-results': 'Soil Health Results',
  fertilizer: 'Fertilizer Recommendation',
  assistant: 'Multilingual AI Assistant',
  reports: 'History & PDF Reports',
  profile: 'Profile & Dataset Governance',
};

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  hi: 'हिन्दी',
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { page, setPage, user, farms, activeFarmId, setActiveFarmId, logout } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigate = (target: AppPage) => {
    setPage(target);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F8F7F4] text-[#18231C]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#FFFFFF] border-r border-[#E2DDD3] z-20">
        <div className="h-16 px-6 flex items-center border-b border-[#E2DDD3]">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#1E4631] rounded"
          >
            <Sprout className="w-5 h-5 text-[#1E4631] shrink-0" />
            <span className="font-display text-lg font-semibold tracking-tight text-[#18231C] whitespace-nowrap">
              SoilSense AI
            </span>
          </button>
        </div>

        {/* Active Farm Selector */}
        <div className="px-4 py-4 border-b border-[#E2DDD3]">
          <label
            htmlFor="sidebar-farm-select"
            className="block text-xs font-medium text-[#556159] mb-1.5"
          >
            Active Farm Plot
          </label>
          {farms.length > 0 ? (
            <select
              id="sidebar-farm-select"
              value={activeFarmId ?? ''}
              onChange={(e) => setActiveFarmId(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-[#F8F7F4] border border-[#E2DDD3] rounded-lg text-[#18231C] focus:outline-none focus:border-[#1E4631]"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName} ({f.district}, {f.state})
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => navigate('farms')}
              className="w-full h-10 px-3 text-xs font-medium text-[#1E4631] bg-[#EFECE6] rounded-lg hover:bg-[#E2DDD3] transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Register First Farm
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#1E4631] text-white'
                    : 'text-[#556159] hover:text-[#18231C] hover:bg-[#EFECE6]/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Farmer Account Footer */}
        <div className="p-4 border-t border-[#E2DDD3]">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-[#18231C] truncate">{user?.name}</p>
            <p className="text-xs text-[#556159] truncate">
              {user?.email} · {LANG_NAMES[user?.preferredLanguage ?? 'en']}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full h-10 px-3 rounded-lg border border-[#E2DDD3] text-xs font-medium text-[#556159] hover:text-[#18231C] hover:bg-[#F8F7F4] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#18231C]/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-[#E2DDD3] z-50">
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#E2DDD3]">
              <span className="font-display text-lg font-semibold text-[#18231C]">SoilSense AI</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-lg text-[#556159] hover:bg-[#EFECE6]"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      active ? 'bg-[#1E4631] text-white' : 'text-[#556159] hover:bg-[#EFECE6]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E2DDD3]">
              <button
                type="button"
                onClick={logout}
                className="w-full h-11 rounded-lg border border-[#E2DDD3] text-sm font-medium text-[#556159] flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Contextual Workspace Header */}
        <header className="sticky top-0 z-10 h-16 bg-[#F8F7F4]/95 backdrop-blur border-b border-[#E2DDD3] px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-[#18231C] hover:bg-[#EFECE6]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#556159] whitespace-nowrap">Workspace</span>
              <span className="hidden sm:inline text-[#C9C2B6]" aria-hidden="true">/</span>
              <h1 className="font-display text-lg font-semibold text-[#18231C] truncate">
                {PAGE_TITLES[page]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('soil-analysis')}
              className="h-10 px-4 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <FlaskConical className="w-4 h-4" />
              New Soil Test
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
