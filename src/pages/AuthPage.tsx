import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sprout } from 'lucide-react';
import type { SupportedLanguage } from '../../shared/types';
import { useApp } from '../context/AppContext';

export function AuthPage() {
  const { setPage, loginWithCredentials, registerAccount, loginDemoFarmer, notify } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>('en');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithCredentials(email, password);
      } else {
        await registerAccount({ name, email, password, phone, preferredLanguage });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginDemoFarmer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo login failed.';
      setError(msg);
      notify('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      <header className="h-16 px-6 max-w-[1280px] w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage('landing')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#556159] hover:text-[#18231C]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-[#1E4631]" />
          <span className="font-display text-lg font-semibold text-[#18231C]">SoilSense AI</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#E2DDD3] rounded-xl overflow-hidden">
          {/* Left Editorial Panel */}
          <div className="lg:col-span-5 bg-[#1E4631] text-white p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs text-[#C7D8CD] mb-3">Farmer Decision-Support Portal</p>
              <h1 className="font-display text-3xl font-semibold leading-tight mb-4">
                Your soil health records, protected and private.
              </h1>
              <p className="text-sm text-[#DDE8E0] leading-relaxed">
                Every farm plot, soil test report, fertilizer plan, and PDF advisory is linked strictly
                to your authenticated farmer account via JWT permissions.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/15">
              <p className="text-xs text-[#C7D8CD] mb-3">
                Want to inspect complete Punjab Wheat, Karnataka Rice &amp; Maharashtra Sugarcane workflows immediately?
              </p>
              <button
                type="button"
                onClick={handleDemo}
                disabled={submitting}
                className="w-full h-11 px-4 rounded-lg bg-white text-[#1E4631] hover:bg-[#F8F7F4] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                Explore All-India Demo Farms
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-[#C7D8CD] mt-2 font-mono">
                Demo credentials: demo@soilsense.in / Farmer@2026
              </p>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-8 sm:p-10">
            <div className="flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg w-fit mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  mode === 'login' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  mode === 'register' ? 'bg-white text-[#18231C] shadow-xs' : 'text-[#556159] hover:text-[#18231C]'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="font-display text-2xl font-semibold text-[#18231C] mb-1">
              {mode === 'login' ? 'Welcome back' : 'Register your farmer account'}
            </h2>
            <p className="text-sm text-[#556159] mb-6">
              {mode === 'login'
                ? 'Sign in with your registered email and password.'
                : 'Set your preferred regional language for AI soil explanations.'}
            </p>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg border border-[#B91C1C]/30 bg-[#FEF2F2] text-sm text-[#991B1B]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-[#18231C] mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Harpreet Singh / Ramesh Kumar"
                    className="w-full h-11 px-3.5 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:outline-none focus:border-[#1E4631] focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-[#18231C] mb-1.5">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.in"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:outline-none focus:border-[#1E4631] focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-[#18231C] mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:outline-none focus:border-[#1E4631] focus:bg-white"
                />
              </div>

              {mode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="auth-phone" className="block text-xs font-semibold text-[#18231C] mb-1.5">
                      Phone Number (Optional)
                    </label>
                    <input
                      id="auth-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98450 00000"
                      className="w-full h-11 px-3.5 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:outline-none focus:border-[#1E4631] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-lang" className="block text-xs font-semibold text-[#18231C] mb-1.5">
                      Preferred Language
                    </label>
                    <select
                      id="auth-lang"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as SupportedLanguage)}
                      className="w-full h-11 px-3 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:outline-none focus:border-[#1E4631] focus:bg-white"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="kn">Kannada (ಕನ್ನಡ)</option>
                      <option value="ta">Tamil (தமிழ்)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold transition-colors disabled:opacity-60 mt-2"
              >
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In to Workspace'
                    : 'Create Farmer Account'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
