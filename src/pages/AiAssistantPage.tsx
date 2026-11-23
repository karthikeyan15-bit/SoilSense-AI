import React, { useEffect, useState } from 'react';
import { BookOpen, Globe, Plus, Send } from 'lucide-react';
import type { ChatMessageRecord, ChatSessionRecord, SupportedLanguage } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const LANGUAGES: Array<{ code: SupportedLanguage; native: string; label: string }> = [
  { code: 'en', native: 'English', label: 'English' },
  { code: 'kn', native: 'ಕನ್ನಡ', label: 'Kannada' },
  { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
  { code: 'te', native: 'తెలుగు', label: 'Telugu' },
  { code: 'hi', native: 'हिन्दी', label: 'Hindi' },
];

const QUICK_PROMPTS: Record<SupportedLanguage, string[]> = {
  en: [
    'Explain my soil deficiencies in simple terms and what I should fix first.',
    'Why was Urea reduced after accounting for DAP in my fertilizer plan?',
    'How should I split Urea and Zinc Sulphate applications safely for my crop?',
  ],
  kn: [
    'ನನ್ನ ಮಣ್ಣಿನ ಪರೀಕ್ಷಾ ವರದಿಯಲ್ಲಿರುವ ಪೋಷಕಾಂಶ ಕೊರತೆಗಳನ್ನು ಸರಳ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ.',
    'ನನ್ನ ರಸಗೊಬ್ಬರ ಯೋಜನೆಯಲ್ಲಿ ಡಿಎಪಿ ಮತ್ತು ಯೂರಿಯಾ ಪ್ರಮಾಣವನ್ನು ಹೇಗೆ ಹಂತ ಹಂತವಾಗಿ ಹಾಕಬೇಕು?',
    'ಜಿಂಕ್ ಸಲ್ಫೇಟ್ ಮತ್ತು ಡಿಎಪಿ ಒಟ್ಟಿಗೆ ಬೆರೆಸಬಾರದು ಏಕೆ?',
  ],
  ta: [
    'என் மண் பரிசோதனை முடிவில் உள்ள சத்து குறைபாடுகளை எளிமையாக விளக்கவும்.',
    'என் பயிருக்கு உரங்களை எந்த நாட்களில் பிரித்து இட வேண்டும்?',
  ],
  te: [
    'నా భూసార పరీక్ష ఫలితాల్లోని పోషక లోపాలను సులభంగా వివరించండి.',
    'నా ఎరువుల ప్రణాళికలో యూరియా మరియు డిఎపిని ఎలా విభజించి వేయాలి?',
  ],
  hi: [
    'मेरी मिट्टी की जांच रिपोर्ट में पोषक तत्वों की कमी को सरल हिंदी में समझाएं।',
    'मेरी उर्वरक योजना में डीएपी और यूरिया को किस समय और कैसे डालना चाहिए?',
  ],
};

export function AiAssistantPage() {
  const { user, activeFarm, analyses, recommendations, notify } = useApp();

  const [language, setLanguage] = useState<SupportedLanguage>(user?.preferredLanguage ?? 'en');
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestAnalysis = activeFarm
    ? analyses.find((a) => a.farmId === activeFarm.id) ?? analyses[0] ?? null
    : analyses[0] ?? null;

  const latestRec = activeFarm
    ? recommendations.find((r) => r.farmId === activeFarm.id) ?? recommendations[0] ?? null
    : recommendations[0] ?? null;

  useEffect(() => {
    api
      .listChatSessions()
      .then((res) => {
        setSessions(res.sessions);
        if (res.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(res.sessions[0].id);
          setMessages(res.sessions[0].messages);
        }
      })
      .catch(() => {
        // Silent initial load
      });
  }, []);

  const handleSelectSession = (session: ChatSessionRecord) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setError(null);
  };

  const handleNewChat = () => {
    setActiveSessionId(undefined);
    setMessages([]);
    setError(null);
  };

  const submitQuestion = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    setQuestion('');

    try {
      const res = await api.sendAssistantMessage({
        question: trimmed,
        language,
        sessionId: activeSessionId,
        farmId: activeFarm?.id,
        soilAnalysisId: latestAnalysis?.id,
        recommendationId: latestRec?.id,
      });

      setActiveSessionId(res.sessionId);
      setMessages((prev) => [...prev, res.message]);

      const refreshed = await api.listChatSessions();
      setSessions(refreshed.sessions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI assistant.';
      setError(msg);
      notify('error', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Context & Session Rail */}
      <div className="lg:col-span-4 space-y-5">
        {/* Language Selector */}
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[#1E4631]" />
            <h3 className="font-display text-base font-semibold text-[#18231C]">Response Language</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`px-3 py-2 rounded-lg text-left text-xs border transition-colors ${
                  language === l.code
                    ? 'bg-[#1E4631] text-white border-[#1E4631]'
                    : 'bg-[#F8F7F4] text-[#18231C] border-[#E2DDD3] hover:bg-[#EFECE6]'
                }`}
              >
                <p className="font-semibold">{l.native}</p>
                <p className={language === l.code ? 'text-[#C7D8CD] text-[11px]' : 'text-[#556159] text-[11px]'}>
                  {l.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Linked Grounding Context */}
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5 space-y-3 text-xs">
          <h3 className="font-display text-base font-semibold text-[#18231C]">
            Active Agronomic Context
          </h3>
          <p className="text-[#556159] leading-relaxed">
            The assistant reads your verified soil test and deterministic fertilizer numbers so it explains
            your real plan without inventing dosages.
          </p>
          <div className="pt-2 border-t border-[#EFECE6] space-y-1.5">
            <p>
              <span className="text-[#556159]">Farm:</span>{' '}
              <span className="font-semibold text-[#18231C]">
                {activeFarm ? `${activeFarm.farmName} (${activeFarm.district}, ${activeFarm.state})` : 'None selected'}
              </span>
            </p>
            <p>
              <span className="text-[#556159]">Soil Report:</span>{' '}
              <span className="font-semibold text-[#18231C]">
                {latestAnalysis
                  ? `${latestAnalysis.sampleDate} · ${latestAnalysis.deficienciesCount} deficient`
                  : 'No report yet'}
              </span>
            </p>
            <p>
              <span className="text-[#556159]">Fertilizer Plan:</span>{' '}
              <span className="font-semibold text-[#18231C]">
                {latestRec
                  ? latestRec.status === 'calculated'
                    ? `${latestRec.crop} (₹${latestRec.totalEstimatedCostInr.toLocaleString('en-IN')})`
                    : 'Expert Review Hold'
                  : 'Not generated yet'}
              </span>
            </p>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white border border-[#E2DDD3] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base font-semibold text-[#18231C]">Saved Conversations</h3>
            <button
              type="button"
              onClick={handleNewChat}
              className="text-xs font-semibold text-[#1E4631] hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-[#556159]">Your multilingual Q&amp;A threads will appear here.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSession(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeSessionId === s.id
                      ? 'bg-[#EFECE6] text-[#18231C] font-semibold'
                      : 'text-[#556159] hover:bg-[#F8F7F4]'
                  }`}
                >
                  <p className="truncate">{s.title}</p>
                  <p className="text-[11px] text-[#556159] font-normal mt-0.5">
                    {s.messages.length} exchange(s) · {s.createdAt.slice(0, 10)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Conversational Panel */}
      <div className="lg:col-span-8 bg-white border border-[#E2DDD3] rounded-xl flex flex-col min-h-[600px]">
        <div className="px-6 py-4 border-b border-[#E2DDD3] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18231C]">
              SoilSense Grounded RAG Assistant
            </h2>
            <p className="text-xs text-[#556159]">
              Answers cite ICAR-IISS, FCO 1985, and Indian SAU (PAU, IARI, TNAU, UAS, MPKV, AAU) documents · Never fabricates fertilizer kg
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[540px]">
          {messages.length === 0 ? (
            <div className="py-6 space-y-5">
              <p className="text-sm text-[#556159] leading-relaxed">
                Ask about your soil pH, nutrient deficiencies, DAP nitrogen credit, split application timing,
                or micronutrient precautions. Choose a suggested question below or type in your preferred
                language:
              </p>
              <div className="space-y-2.5">
                {QUICK_PROMPTS[language].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitQuestion(prompt)}
                    disabled={sending}
                    className="w-full text-left p-3.5 rounded-lg border border-[#E2DDD3] bg-[#F8F7F4] hover:bg-[#EFECE6] text-sm text-[#18231C] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {/* Farmer Prompt */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl bg-[#1E4631] text-white px-4 py-3 text-sm leading-relaxed">
                    {msg.question}
                  </div>
                </div>

                {/* Assistant Grounded Reply */}
                <div className="max-w-[95%] rounded-xl bg-[#F8F7F4] border border-[#E2DDD3] p-5 space-y-4">
                  <div className="flex items-center justify-between text-[11px] text-[#556159]">
                    <span>
                      SoilSense AI · {LANGUAGES.find((l) => l.code === msg.language)?.native ?? msg.language}
                    </span>
                    <span className="font-mono">
                      {msg.provider === 'nvidia' ? 'NVIDIA NIM Fallback' : 'Gemini 4 Hydrogen RAG'}
                    </span>
                  </div>

                  <div className="text-sm text-[#18231C] leading-relaxed whitespace-pre-wrap">
                    {msg.answer}
                  </div>

                  {/* Retrieved RAG Citations */}
                  {msg.sourceReferences.length > 0 && (
                    <div className="pt-3 border-t border-[#E2DDD3]">
                      <p className="text-[11px] font-semibold text-[#556159] mb-2 inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#1E4631]" />
                        Retrieved Agricultural References ({msg.sourceReferences.length})
                      </p>
                      <div className="space-y-2">
                        {msg.sourceReferences.map((src) => (
                          <div
                            key={src.id}
                            className="p-2.5 rounded-md bg-white border border-[#E2DDD3] text-xs"
                          >
                            <p className="font-semibold text-[#18231C]">{src.title}</p>
                            <p className="text-[11px] text-[#556159]">{src.organization}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="rounded-xl bg-[#F8F7F4] border border-[#E2DDD3] p-5 animate-pulse space-y-2">
              <div className="h-3 bg-[#E2DDD3] rounded w-1/3" />
              <div className="h-4 bg-[#E2DDD3] rounded w-full" />
              <div className="h-4 bg-[#E2DDD3] rounded w-5/6" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#B91C1C]/30 text-sm text-[#991B1B]">
              {error}
            </div>
          )}
        </div>

        {/* Input Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="p-4 border-t border-[#E2DDD3] flex items-center gap-3"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask SoilSense AI in ${LANGUAGES.find((l) => l.code === language)?.label}...`}
            disabled={sending}
            className="flex-1 h-11 px-4 rounded-lg border border-[#D4CEC2] bg-[#F8F7F4] text-sm focus:bg-white focus:border-[#1E4631] focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || question.trim().length < 2}
            className="h-11 px-5 rounded-lg bg-[#1E4631] hover:bg-[#163625] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
