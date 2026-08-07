import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ParsedResume,
  JobInfo,
  ResumeAnalysis,
  InterviewPrep,
  ConversationTurn,
  Settings,
  ThemeMode,
} from '@/lib/types';

interface CopilotState {
  // Setup data
  resume: ParsedResume | null;
  job: JobInfo | null;
  analysis: ResumeAnalysis | null;
  prep: InterviewPrep | null;

  // Interview
  turns: ConversationTurn[];
  currentQuestion: string;
  currentAnswer: string;
  isListening: boolean;
  isThinking: boolean;
  isListeningToInterviewer: boolean;
  listeningBuffer: string;
  deepgramConnected: boolean;
  deepgramSpeaking: boolean;
  teleprompterOpen: boolean;

  // Settings
  settings: Settings;

  // Actions
  setResume: (r: ParsedResume | null) => void;
  setJob: (j: JobInfo) => void;
  setAnalysis: (a: ResumeAnalysis | null) => void;
  setPrep: (p: InterviewPrep | null) => void;
  addTurn: (t: ConversationTurn) => void;
  updateTurn: (id: string, patch: Partial<ConversationTurn>) => void;
  clearConversation: () => void;
  setCurrentQuestion: (q: string) => void;
  setCurrentAnswer: (a: string) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setIsListeningToInterviewer: (v: boolean) => void;
  setListeningBuffer: (buffer: string) => void;
  setDeepgramConnected: (v: boolean) => void;
  setDeepgramSpeaking: (v: boolean) => void;
  setTeleprompterOpen: (v: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setTheme: (t: ThemeMode) => void;
}

const defaultSettings: Settings = {
  theme: 'dark',
  openRouterModel: 'auto',
  teleprompterFontSize: 28,
  teleprompterOpacity: 0.92,
  teleprompterAutoScroll: true,
  streamingSpeed: 40,
  useMic: false,
};

export const useCopilotStore = create<CopilotState>()(
  persist(
    (set) => ({
      resume: null,
      job: null,
      analysis: null,
      prep: null,
      turns: [],
      currentQuestion: '',
      currentAnswer: '',
      isListening: false,
      isThinking: false,
      isListeningToInterviewer: false,
      listeningBuffer: '',
      deepgramConnected: false,
      deepgramSpeaking: false,
      teleprompterOpen: false,
      settings: defaultSettings,

      setResume: (r) => set({ resume: r }),
      setJob: (j) => set({ job: j }),
      setAnalysis: (a) => set({ analysis: a }),
      setPrep: (p) => set({ prep: p }),
      addTurn: (t) => set((s) => ({ turns: [...s.turns, t] })),
      updateTurn: (id, patch) =>
        set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      clearConversation: () => set({ turns: [], currentQuestion: '', currentAnswer: '' }),
      setCurrentQuestion: (q) => set({ currentQuestion: q }),
      setCurrentAnswer: (a) => set({ currentAnswer: a }),
      setListening: (v) => set({ isListening: v }),
      setThinking: (v) => set({ isThinking: v }),
      setIsListeningToInterviewer: (v) => set({ isListeningToInterviewer: v, listeningBuffer: v ? '' : '' }),
      setListeningBuffer: (buffer) => set({ listeningBuffer: buffer }),
      setDeepgramConnected: (v) => set({ deepgramConnected: v }),
      setDeepgramSpeaking: (v) => set({ deepgramSpeaking: v }),
      setTeleprompterOpen: (v) => set({ teleprompterOpen: v }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setTheme: (t) => set((s) => ({ settings: { ...s.settings, theme: t } })),
    }),
    {
      name: 'interview-copilot-v1',
      partialize: (s) => ({
        resume: s.resume,
        job: s.job,
        analysis: s.analysis,
        prep: s.prep,
        settings: s.settings,
      }),
    }
  )
);
