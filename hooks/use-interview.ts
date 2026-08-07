'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCopilotStore } from '@/lib/store';
import { DeepgramStream } from '@/lib/ai/deepgram';
import { streamChat, extractJson } from '@/lib/ai/client';
import type { AIAnswer, ConversationTurn, QuestionType, TranscriptSegment } from '@/lib/types';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  situational: 'Situational',
  leadership: 'Leadership',
  culture_fit: 'Culture Fit',
  problem_solving: 'Problem Solving',
  salary: 'Salary',
  strength: 'Strength',
  weakness: 'Weakness',
  follow_up: 'Follow-up',
  general: 'General',
};

export function useInterview() {
  // Select only stable action references — avoids re-renders on state changes.
  // Zustand actions have stable identity, so these never change between renders.
  const addTurn = useCopilotStore((s) => s.addTurn);
  const setCurrentQuestion = useCopilotStore((s) => s.setCurrentQuestion);
  const setCurrentAnswer = useCopilotStore((s) => s.setCurrentAnswer);
  const setListening = useCopilotStore((s) => s.setListening);
  const setThinking = useCopilotStore((s) => s.setThinking);
  const setIsListeningToInterviewer = useCopilotStore((s) => s.setIsListeningToInterviewer);
  const setDeepgramConnected = useCopilotStore((s) => s.setDeepgramConnected);
  const setDeepgramSpeaking = useCopilotStore((s) => s.setDeepgramSpeaking);
  // Select only the scalar we need for the config effect dependency.
  const openRouterModel = useCopilotStore((s) => s.settings.openRouterModel);

  const deepgramRef = useRef<DeepgramStream | null>(null);
  const lastQuestionRef = useRef('');
  const answerAbortRef = useRef<AbortController | null>(null);
  const configRef = useRef<{ deepgramKey: string; model: string } | null>(null);
  const isGeneratingRef = useRef(false);

  // Load config once (re-fetch if model changes)
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        configRef.current = { deepgramKey: d.deepgramApiKey, model: openRouterModel };
      })
      .catch(() => {});
  }, [openRouterModel]);

  const buildContextMessages = useCallback(() => {
    // Read current state at call-time via getState() — avoids capturing stale
    // state in deps while still getting the latest values when invoked.
    const { resume, job, turns } = useCopilotStore.getState();
    const sys: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    if (resume) {
      sys.push({ role: 'system', content: `CANDIDATE RESUME:\n${resume.text.slice(0, 4000)}` });
    }
    if (job) {
      sys.push({
        role: 'system',
        content: `JOB: ${job.role} at ${job.company} (${job.interviewType})\nDESCRIPTION:\n${job.description.slice(0, 2000)}`,
      });
    }
    // Conversation memory: last 8 turns
    const recent = turns.slice(-8);
    for (const t of recent) {
      sys.push({
        role: t.role === 'interviewer' ? 'user' : 'assistant',
        content: t.role === 'interviewer' ? `Interviewer: ${t.content}` : `Candidate (suggested): ${t.content}`,
      });
    }
    return sys;
  }, []);

  const generateAnswer = useCallback(
    async (question: string) => {
      if (!question.trim() || question === lastQuestionRef.current) return;
      if (isGeneratingRef.current) return;
      lastQuestionRef.current = question;
      isGeneratingRef.current = true;
      setCurrentQuestion(question);
      setThinking(true);

      // Cancel any in-flight answer
      answerAbortRef.current?.abort();
      const ac = new AbortController();
      answerAbortRef.current = ac;

      let raw = '';
      const messages = [
        ...buildContextMessages(),
        { role: 'user' as const, content: `Interviewer asks: "${question}"\n\nGenerate the answer now.` },
      ];

      setCurrentAnswer('');
      try {
        await streamChat({
          task: 'answer-question',
          messages,
          model: configRef.current?.model ?? 'auto',
          signal: ac.signal,
          onToken: (chunk) => {
            raw += chunk;
            setCurrentAnswer(raw);
          },
        });

        const parsed = extractJson<AIAnswer>(raw);
        const turn: ConversationTurn = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: question,
          questionType: parsed?.questionType ?? 'general',
          confidence: parsed?.confidenceScore ?? 0,
          answer: parsed ?? undefined,
          timestamp: Date.now(),
        };
        addTurn(turn);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Aborted — a new question came in, don't add a turn
        } else {
          console.error('Failed to generate answer:', err);
        }
      } finally {
        isGeneratingRef.current = false;
        setThinking(false);
      }
    },
    [buildContextMessages, addTurn, setCurrentAnswer, setCurrentQuestion, setThinking]
  );

  const handleSpeechStarted = useCallback(
    () => {
      // The interviewer started speaking — AI should show it's listening
      setIsListeningToInterviewer(true);
      setDeepgramSpeaking(true);
      setCurrentQuestion('');
    },
    [setIsListeningToInterviewer, setDeepgramSpeaking, setCurrentQuestion]
  );

  const handleSegment = useCallback(
    (seg: TranscriptSegment) => {
      if (seg.isFinal && seg.text.trim()) {
        // Add interviewer turn to history
        addTurn({
          id: crypto.randomUUID(),
          role: 'interviewer',
          content: seg.text.trim(),
          questionType: 'general',
          confidence: seg.confidence,
          timestamp: Date.now(),
        });
      } else {
        // Interim — show live partial (but only if we're in listening mode)
        if (useCopilotStore.getState().isListeningToInterviewer) {
          setCurrentQuestion(seg.text.trim());
        }
      }
    },
    [addTurn, setCurrentQuestion]
  );

  const handleSpeechEnd = useCallback(
    (text: string) => {
      // The interviewer finished speaking
      // Update the listening state
      setIsListeningToInterviewer(false);
      setDeepgramSpeaking(false);
      setCurrentQuestion(text);

      // Now generate the answer
      if (text.trim()) {
        generateAnswer(text);
      }
    },
    [generateAnswer, setIsListeningToInterviewer, setDeepgramSpeaking, setCurrentQuestion]
  );

  const startInterview = useCallback(async () => {
    const config = configRef.current;
    if (!config?.deepgramKey) {
      // try loading again
      const d = await fetch('/api/config').then((r) => r.json());
      if (!d.deepgramApiKey) return { error: 'No audio. Enable "Share audio" when sharing.' };
      configRef.current = { deepgramKey: d.deepgramApiKey, model: useCopilotStore.getState().settings.openRouterModel };
    }

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as MediaTrackConstraints,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        return { error: 'Screen share permission denied. Click "Start Interview" again and allow screen sharing with audio.' };
      }
      return { error: `Could not start screen share: ${err instanceof Error ? err.message : String(err)}` };
    }
    const audioTracks = display.getAudioTracks();
    if (audioTracks.length === 0) {
      display.getTracks().forEach((t) => t.stop());
      return { error: 'No audio. Enable "Share audio" when sharing.' };
    }
    let stream = new MediaStream(audioTracks);
    if (useCopilotStore.getState().settings.useMic) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        // ignore mic errors — screen audio is the primary source
      }
    }

                            deepgramRef.current = new DeepgramStream({
      apiKey: configRef.current!.deepgramKey,
      onSegment: handleSegment,
      onSpeechEnd: handleSpeechEnd,
      onSpeechStarted: handleSpeechStarted,
      onOpen: () => setDeepgramConnected(true),
      onClose: () => {
        setDeepgramConnected(false);
        setDeepgramSpeaking(false);
      },
      onError: (e) => console.error('Deepgram:', e),
    });
    await deepgramRef.current.start(stream);
    setListening(true);
    return { ok: true };
  }, [handleSegment, handleSpeechEnd, handleSpeechStarted, setDeepgramConnected, setListening]);

  const stopInterview = useCallback(() => {
    deepgramRef.current?.stop();
    deepgramRef.current = null;
    answerAbortRef.current?.abort();
    isGeneratingRef.current = false;
    setListening(false);
    setDeepgramConnected(false);
    setIsListeningToInterviewer(false);
    setDeepgramSpeaking(false);
  }, [setListening, setDeepgramConnected, setIsListeningToInterviewer, setDeepgramSpeaking]);

  // Cleanup on unmount only — stopInterview is now stable (no state in deps)
  useEffect(() => () => stopInterview(), [stopInterview]);

  return { startInterview, stopInterview, generateAnswer, QUESTION_TYPE_LABELS };
}