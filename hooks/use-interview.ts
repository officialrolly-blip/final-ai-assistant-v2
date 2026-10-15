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
  const setListeningBuffer = useCopilotStore((s) => s.setListeningBuffer);
  // Select only the scalar we need for the config effect dependency.
  const openRouterModel = useCopilotStore((s) => s.settings.openRouterModel);

  const deepgramRef = useRef<DeepgramStream | null>(null);
  const lastQuestionRef = useRef('');
  const answerAbortRef = useRef<AbortController | null>(null);
  const configRef = useRef<{ deepgramKey: string; model: string } | null>(null);
  const isGeneratingRef = useRef(false);
  // Accumulates finalized speech for the question currently being asked, plus a
  // debounce timer that finalizes the question when the interviewer pauses.
  // This is a reliable fallback in case Deepgram's VAD SpeechEnded event
  // doesn't arrive — otherwise the UI gets stuck on "AI is listening...".
  const pendingQuestionRef = useRef('');
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic token identifying the latest answer generation. Lets an aborted /
  // superseded request detect that it's no longer current and bail out instead
  // of parsing empty output or clobbering a newer in-flight answer's state.
  const genTokenRef = useRef(0);

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
      const q = question.trim();
      if (!q) return;
      // Dedupe: if we're already answering (or finished) this exact question, do nothing.
      if (q === lastQuestionRef.current) return;
      // Otherwise supersede any in-flight (possibly speculative) answer with this one.
      lastQuestionRef.current = q;
      isGeneratingRef.current = true;
      setCurrentQuestion(q);
      setThinking(true);

      // Cancel any in-flight answer and claim a fresh generation token.
      answerAbortRef.current?.abort();
      const ac = new AbortController();
      answerAbortRef.current = ac;
      const token = ++genTokenRef.current;

      let raw = '';
      const messages = [
        ...buildContextMessages(),
        { role: 'user' as const, content: `Interviewer asks: "${q}"\n\nGenerate the answer now.` },
      ];

      setCurrentAnswer('');
      try {
        const res = await streamChat({
          task: 'answer-question',
          messages,
          model: configRef.current?.model ?? 'auto',
          signal: ac.signal,
          onToken: (chunk) => {
            // Ignore late tokens from a superseded/aborted generation.
            if (token !== genTokenRef.current) return;
            raw += chunk;
            setCurrentAnswer(raw);
          },
        });

        // A newer question superseded this one while we were streaming — bail out
        // without parsing, adding a turn, or touching shared state.
        if (token !== genTokenRef.current) return;

        if (!res.ok || !raw.trim()) {
          // Aborted, network error, or empty model output. Only surface an error
          // if this is still the active generation (not a silent supersede).
          if (token === genTokenRef.current) {
            console.warn('Answer generation produced no output.', res.error ?? '');
          }
          return;
        }

        const parsed = extractJson<AIAnswer>(raw);
        if (!parsed) {
          console.warn('Could not parse AI answer JSON.');
          return;
        }
        const turn: ConversationTurn = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: q,
          questionType: parsed.questionType ?? 'general',
          confidence: parsed.confidenceScore ?? 0,
          answer: parsed,
          timestamp: Date.now(),
        };
        addTurn(turn);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Aborted — a new/superseding question came in, don't add a turn
        } else {
          console.error('Failed to generate answer:', err);
        }
      } finally {
        // Only the latest generation owns the shared "thinking" state.
        if (token === genTokenRef.current) {
          isGeneratingRef.current = false;
          setThinking(false);
        }
      }
    },
    [buildContextMessages, addTurn, setCurrentAnswer, setCurrentQuestion, setThinking]
  );

  // Always call the latest generateAnswer from interim callbacks (avoids stale closures).
  const generateAnswerRef = useRef(generateAnswer);
  generateAnswerRef.current = generateAnswer;

  // Finalize the current question when the interviewer stops speaking. Triggered
  // either by Deepgram's VAD SpeechEnded event or by the end-of-speech debounce
  // timer (a reliable fallback if VAD events don't arrive). Always resets the
  // "listening" state so the UI never gets stuck, then generates the answer.
  const finalizeQuestion = useCallback(
    (text: string) => {
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      const question = text.trim();
      setIsListeningToInterviewer(false);
      setDeepgramSpeaking(false);
      setListeningBuffer('');
      pendingQuestionRef.current = '';
      if (question) generateAnswer(question);
    },
    [generateAnswer, setIsListeningToInterviewer, setDeepgramSpeaking, setListeningBuffer]
  );

  // Always call the latest finalizeQuestion from timer callbacks (avoids stale closures).
  const finalizeRef = useRef(finalizeQuestion);
  finalizeRef.current = finalizeQuestion;

  const handleSpeechStarted = useCallback(
    () => {
      // The interviewer started speaking — reset any pending question + timer
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      pendingQuestionRef.current = '';
      // Allow the same question text to be answered again in a new utterance.
      lastQuestionRef.current = '';
      setIsListeningToInterviewer(true);
      setDeepgramSpeaking(true);
      setCurrentQuestion('');
    },
    [setIsListeningToInterviewer, setDeepgramSpeaking, setCurrentQuestion]
  );

  const handleSegment = useCallback(
    (seg: TranscriptSegment) => {
      if (seg.isFinal && seg.text.trim()) {
        const text = seg.text.trim();
        // Commit finalized interviewer speech to the permanent transcript history
        addTurn({
          id: crypto.randomUUID(),
          role: 'interviewer',
          content: text,
          questionType: 'general',
          confidence: seg.confidence,
          timestamp: Date.now(),
        });
        // Accumulate finalized speech for the question currently being asked
        pendingQuestionRef.current = (pendingQuestionRef.current + ' ' + text).trim();
        setListeningBuffer('');
        // We're actively hearing speech
        if (!useCopilotStore.getState().isListeningToInterviewer) {
          setIsListeningToInterviewer(true);
        }
        // (Re)start the end-of-speech debounce: if no new final arrives in time,
        // treat it as the end of the question and generate the answer.
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        endTimerRef.current = setTimeout(() => {
          finalizeRef.current(pendingQuestionRef.current);
        }, 1200);
      } else {
        // Interim — update the live partial transcript in real time (word-by-word)
        const partial = seg.text.trim();
        setListeningBuffer(partial);
        if (!useCopilotStore.getState().isListeningToInterviewer) {
          setIsListeningToInterviewer(true);
        }
        // Speculative early-start: if the partial transcript already looks like a
        // complete question (ends with "?"), begin generating NOW — while the
        // interviewer is still finishing — so the answer is ready almost instantly.
        if (looksLikeCompleteQuestion(partial)) {
          const speculative = (pendingQuestionRef.current + ' ' + partial).trim();
          generateAnswerRef.current(speculative);
        }
      }
    },
    [addTurn, setListeningBuffer, setIsListeningToInterviewer]
  );

  const handleSpeechEnd = useCallback(
    (_text: string) => {
      // VAD reported the interviewer finished speaking — finalize immediately.
      // (The debounce timer in handleSegment is the fallback if this never fires.)
      finalizeRef.current(pendingQuestionRef.current || _text);
    },
    []
  );

  // Safety net: VAD said speech ended even if no finalized text was captured.
  // Guarantees the "listening" indicator can never get stuck.
  const handleSpeechEnded = useCallback(
    () => {
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      setIsListeningToInterviewer(false);
      setDeepgramSpeaking(false);
    },
    [setIsListeningToInterviewer, setDeepgramSpeaking]
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
      onSpeechEnded: handleSpeechEnded,
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
  }, [handleSegment, handleSpeechEnd, handleSpeechStarted, handleSpeechEnded, setDeepgramConnected, setListening]);

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

// Heuristic: does a partial (still-streaming) transcript look like a finished
// question? We start generating speculatively as soon as it does, so the answer
// is ready by the time the interviewer stops talking.
// - Must end with a question mark (allowing trailing quotes/punctuation).
// - Must be long enough to be a real question (avoid firing on a lone "?").
function looksLikeCompleteQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false; // too short to be a meaningful question
  return /[?？]["'”’)\]]?\s*$/.test(t);
}