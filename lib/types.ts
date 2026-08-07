// Core domain types for the Interview Copilot

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type InterviewType = 'technical' | 'behavioral' | 'hr' | 'mixed';

export type QuestionType =
  | 'behavioral'
  | 'technical'
  | 'situational'
  | 'leadership'
  | 'culture_fit'
  | 'problem_solving'
  | 'salary'
  | 'strength'
  | 'weakness'
  | 'follow_up'
  | 'general';

export interface ParsedResume {
  text: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  sizeBytes: number;
}

export interface JobInfo {
  role: string;
  company: string;
  description: string;
  interviewType: InterviewType;
}

export interface ResumeAnalysis {
  overallScore: number;
  atsCompatibility: number;
  resumeQuality: number;
  keywordMatch: number;
  missingSkills: string[];
  technicalSkills: string[];
  softSkills: string[];
  relevantExperience: string[];
  projects: string[];
  achievements: string[];
  formatting: string[];
  grammar: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  type: QuestionType;
  category: 'behavioral' | 'technical' | 'company' | 'star' | 'weakness' | 'strength';
  suggestedAnswer: string;
  keyPoints: string[];
}

export interface InterviewPrep {
  behavioralQuestions: InterviewQuestion[];
  technicalQuestions: InterviewQuestion[];
  companyQuestions: InterviewQuestion[];
  starExamples: { situation: string; task: string; action: string; result: string }[];
  weaknessQuestions: InterviewQuestion[];
  strengthQuestions: InterviewQuestion[];
}

export interface TranscriptSegment {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: number;
  start: number;
  duration: number;
  confidence: number;
}

export interface ConversationTurn {
  id: string;
  role: 'interviewer' | 'assistant';
  content: string;
  questionType: QuestionType;
  confidence: number;
  answer?: AIAnswer;
  timestamp: number;
}

export interface AIAnswer {
  professionalResponse: string;
  starResponse?: string;
  bulletPoints: string[];
  keywords: string[];
  shortVersion: string;
  expandedVersion: string;
  followUps: string[];
  speakingTimeEstimate: string;
  confidenceScore: number;
  questionType: QuestionType;
}

export type ThemeMode = 'dark' | 'light';

export interface Settings {
  theme: ThemeMode;
  openRouterModel: string; // 'auto' or a specific model id
  teleprompterFontSize: number;
  teleprompterOpacity: number;
  teleprompterAutoScroll: boolean;
  streamingSpeed: number; // words per second target
  useMic: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  context: string;
  free: boolean;
}
