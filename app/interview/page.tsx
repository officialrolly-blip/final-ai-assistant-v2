'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Radio, ArrowLeft, Loader2, Sparkles, Clock,
  Lightbulb, ListChecks, Tag, ChevronRight, CircleDot, Eye, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCopilotStore } from '@/lib/store';
import { useInterview } from '@/hooks/use-interview';
import type { AIAnswer, ConversationTurn } from '@/lib/types';

export default function InterviewPage() {
  const router = useRouter();
  const store = useCopilotStore();
  const { startInterview, stopInterview, QUESTION_TYPE_LABELS } = useInterview();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const handleStart = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const result = await startInterview();
      if (result && 'error' in result && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview. Please try again.');
    } finally {
      setStarting(false);
    }
  }, [startInterview]);

  useEffect(() => {
    if (!store.resume || !store.job) router.push('/');
  }, [store.resume, store.job, router]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.turns]);

  useEffect(() => {
    answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.turns, store.isThinking]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && store.isListening) {
        stopInterview();
        router.push('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.isListening, stopInterview, router]);

  if (!store.resume || !store.job) return null;

  const interviewerTurns = store.turns.filter((t) => t.role === 'interviewer');
  const assistantTurns = store.turns.filter((t) => t.role === 'assistant');
  const latestAnswer = assistantTurns[assistantTurns.length - 1]?.answer;
  const latestQuestionType = assistantTurns[assistantTurns.length - 1]?.questionType;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { if (store.isListening) stopInterview(); router.push('/'); }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Exit
          </Button>
          <div className="flex items-center gap-2">
            <div className={`flex h-2 w-2 items-center justify-center rounded-full ${store.deepgramConnected ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
              {store.deepgramConnected && <span className="absolute h-2 w-2 animate-pulse-ring rounded-full bg-emerald-500" />}
            </div>
            <span className="text-sm text-muted-foreground">
              {store.deepgramConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* AI Listening Indicator */}
          {store.isListeningToInterviewer && (
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </div>
              <span className="text-sm font-medium text-primary">AI is listening...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="gap-2" onClick={() => store.setTeleprompterOpen(true)}>
            <Eye className="h-4 w-4" /> Teleprompter
          </Button>
          {store.isListening ? (
            <Button variant="destructive" size="sm" className="gap-2" onClick={stopInterview}>
              <MicOff className="h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button size="sm" className="gap-2 rounded-full" onClick={handleStart} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              {starting ? 'Starting…' : 'Start Interview'}
            </Button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex shrink-0 items-center gap-3 border-b border-destructive/30 bg-destructive/5 px-6 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_1fr]">
        {/* LEFT PANEL — Transcript */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="shrink-0 px-6 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Mic className="h-4 w-4 text-primary" /> Live Transcript
            </h2>
          </div>
                    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {interviewerTurns.length === 0 && !store.currentQuestion ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Radio className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium">Ready when you are</p>
                <p className="mt-1 text-sm">Press Start Interview and share your screen with audio.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {store.turns.map((turn) => (
                    <TurnBubble key={turn.id} turn={turn} />
                  ))}
                </AnimatePresence>
                
                {/* Live transcription while interviewer is speaking */}
                {store.isListeningToInterviewer && store.currentQuestion && (
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Interviewer</span>
                      <span className="text-xs text-muted-foreground/60">(Listening...)</span>
                    </div>
                    <p className="leading-relaxed">{store.currentQuestion}</p>
                  </div>
                )}
                
                {/* AI is processing/generating response */}
                {store.isThinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Generating response…
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          {/* Current question card */}
          {(store.currentQuestion || latestQuestionType) && (
            <div className="shrink-0 border-t border-border px-6 py-4">
              <div className="mb-2 flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Question</span>
                {latestQuestionType && (
                  <Badge variant="secondary" className="ml-auto capitalize">
                    {QUESTION_TYPE_LABELS[latestQuestionType]}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {store.currentQuestion || 'Listening…'}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — AI Answer */}
        <div className="flex min-h-0 flex-col">
          <div className="shrink-0 px-6 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> AI Answer
            </h2>
          </div>
                    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {assistantTurns.length === 0 && !store.isThinking && !store.isListeningToInterviewer ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Sparkles className="mb-4 h-12 w-12 text-primary/40" />
                <p className="font-medium">Answers appear here</p>
                <p className="mt-1 text-sm">When the interviewer asks a question, the AI will generate an instant response.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {assistantTurns.map((turn, idx) => (
                    turn.answer && (
                      <motion.div
                        key={turn.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        {/* Question this answer is for */}
                        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                          <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              Q{idx + 1}: {turn.content}
                            </p>
                          </div>
                        </div>
                        <AnswerView answer={turn.answer} />
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>

                {/* AI is listening to interviewer */}
                {store.isListeningToInterviewer && !store.isThinking && (
                  <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-4">
                    <div className="relative">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Mic className="h-5 w-5 text-primary animate-pulse" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">AI is listening...</p>
                      <p className="text-xs text-muted-foreground">Processing your question</p>
                    </div>
                  </div>
                )}

                {/* AI is generating response */}
                {store.isThinking && (
                  <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Generating response...</p>
                      <p className="text-xs text-muted-foreground">Analyzing and preparing your answer</p>
                    </div>
                  </div>
                )}

                {/* Show streaming partial answer if available */}
                {store.currentAnswer && store.isThinking && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                      <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">
                        {store.currentQuestion || 'Current question'}
                      </p>
                    </div>
                    <Card className="glass border-0 shadow-lg">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-primary" /> Professional Response
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{store.currentAnswer}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div ref={answerEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isInterviewer = turn.role === 'interviewer';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isInterviewer ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isInterviewer
          ? 'bg-muted text-foreground'
          : 'bg-primary/10 text-foreground border border-primary/20'
      }`}>
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {isInterviewer ? 'Interviewer' : 'AI Coach'}
          </span>
          {turn.questionType && turn.questionType !== 'general' && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">{turn.questionType}</Badge>
          )}
        </div>
        <p className="leading-relaxed">{turn.content}</p>
      </div>
    </motion.div>
  );
}

function AnswerView({ answer }: { answer: AIAnswer }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Confidence + time */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-xs font-bold text-primary">{answer.confidenceScore}</span>
          </div>
          <span className="text-xs text-muted-foreground">Confidence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{answer.speakingTimeEstimate}</span>
        </div>
        <Badge variant="secondary" className="ml-auto capitalize">{answer.questionType}</Badge>
      </div>

      {/* Professional response */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-primary" /> Professional Response</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{answer.professionalResponse}</p></CardContent>
      </Card>

      {/* Short version */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Short Version</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{answer.shortVersion}</p></CardContent>
      </Card>

      {/* STAR */}
      {answer.starResponse && (
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ListChecks className="h-4 w-4 text-primary" /> STAR Format</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{answer.starResponse}</p></CardContent>
        </Card>
      )}

      {/* Bullet points */}
      {answer.bulletPoints?.length > 0 && (
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ChevronRight className="h-4 w-4 text-primary" /> Key Talking Points</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {answer.bulletPoints.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Keywords */}
      {answer.keywords?.length > 0 && (
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Tag className="h-4 w-4 text-primary" /> Keywords</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {answer.keywords.map((k, i) => <Badge key={i} variant="outline" className="text-xs">{k}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-ups */}
      {answer.followUps?.length > 0 && (
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-primary" /> Follow-up Suggestions</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {answer.followUps.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">{i + 1}.</span> {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Expanded */}
      {answer.expandedVersion && answer.expandedVersion !== answer.professionalResponse && (
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expanded Version</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{answer.expandedVersion}</p></CardContent>
        </Card>
      )}
    </motion.div>
  );
}