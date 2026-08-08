'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, FileText, Brain, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCopilotStore } from '@/lib/store';
import { streamChat, extractJson } from '@/lib/ai/client';
import type { ResumeAnalysis, InterviewPrep } from '@/lib/types';
import { toast } from 'sonner';

export default function AnalyzePage() {
  const router = useRouter();
  const resume = useCopilotStore((s) => s.resume);
  const job = useCopilotStore((s) => s.job);
  const analysis = useCopilotStore((s) => s.analysis);
  const prep = useCopilotStore((s) => s.prep);
  const setAnalysis = useCopilotStore((s) => s.setAnalysis);
  const setPrep = useCopilotStore((s) => s.setPrep);
  const modelSetting = useCopilotStore((s) => s.settings.openRouterModel);

  const [loading, setLoading] = useState<'analysis' | 'prep' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resume || !job) {
      router.push('/');
      return;
    }
    if (!analysis) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = async () => {
    setLoading('analysis');
    setError(null);
    let raw = '';
    const messages = [
      { role: 'user' as const, content: `RESUME:\n${resume?.text ?? ''}\n\nJOB: ${job?.role} at ${job?.company}\nDESCRIPTION:\n${job?.description ?? ''}` },
    ];
    const res = await streamChat({
      task: 'analyze-resume',
      messages,
      model: modelSetting,
      onToken: (c) => { raw += c; },
    });
    if (!res.ok) { setError(res.error ?? 'Analysis failed'); setLoading(null); return; }
    
    // Log the raw response for debugging
    console.log('Raw AI response for analysis:', raw.substring(0, 500) + (raw.length > 500 ? '...' : ''));
    
    const parsed = extractJson<ResumeAnalysis>(raw);
    if (!parsed) { 
      setError('Could not parse AI response. The AI model returned invalid format. Please try again or switch to a different model in settings.'); 
      setLoading(null); 
      return; 
    }
    setAnalysis(parsed);
    setLoading(null);
    toast.success('Resume analysis complete');
  };

  const runPrep = async () => {
    setLoading('prep');
    setError(null);
    let raw = '';
    const messages = [
      { role: 'user' as const, content: `RESUME:\n${resume?.text ?? ''}\n\nJOB: ${job?.role} at ${job?.company}\nDESCRIPTION:\n${job?.description ?? ''}\nInterview type: ${job?.interviewType}` },
    ];
    const res = await streamChat({
      task: 'interview-prep',
      messages,
      model: modelSetting,
      onToken: (c) => { raw += c; },
    });
    if (!res.ok) { setError(res.error ?? 'Prep failed'); setLoading(null); return; }
    
    // Log the raw response for debugging
    console.log('Raw AI response for prep:', raw.substring(0, 500) + (raw.length > 500 ? '...' : ''));
    
    const parsed = extractJson<InterviewPrep>(raw);
    if (!parsed) { 
      setError('Could not parse AI response. The AI model returned invalid format. Please try again or switch to a different model in settings.'); 
      setLoading(null); 
      return; 
    }
    setPrep(parsed);
    setLoading(null);
    toast.success('Interview prep generated');
  };

  if (!resume || !job) return null;

  return (
    <div className="relative min-h-screen bg-background bg-aurora">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Home
        </Button>
        <Button size="sm" className="gap-2 rounded-full" onClick={() => router.push('/interview')}>
          Interview Mode <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Resume Analysis & Prep</h1>
          <p className="mt-1 text-muted-foreground">
            {job.role} at {job.company}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={runAnalysis}>Retry</Button>
          </div>
        )}

        <Tabs defaultValue="analysis">
          <TabsList className="mb-6">
            <TabsTrigger value="analysis" className="gap-1.5">
              <FileText className="h-4 w-4" /> Analysis
            </TabsTrigger>
            <TabsTrigger value="prep" className="gap-1.5" onClick={() => !prep && runPrep()}>
              <Brain className="h-4 w-4" /> Interview Prep
            </TabsTrigger>
          </TabsList>

          {/* ANALYSIS TAB */}
          <TabsContent value="analysis">
            {loading === 'analysis' && !analysis ? (
              <LoadingCard label="Analyzing your resume against the job description…" />
            ) : analysis ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Scores */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <ScoreCard label="Overall" value={analysis.overallScore} />
                  <ScoreCard label="ATS Compat" value={analysis.atsCompatibility} />
                  <ScoreCard label="Quality" value={analysis.resumeQuality} />
                  <ScoreCard label="Keyword Match" value={analysis.keywordMatch} />
                </div>

                <Card className="glass border-0 shadow-lg">
                  <CardHeader><CardTitle className="text-lg">Summary</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p></CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <ListCard title="Strengths" items={analysis.strengths} variant="positive" />
                  <ListCard title="Weaknesses" items={analysis.weaknesses} variant="warning" />
                  <ListCard title="Missing Skills" items={analysis.missingSkills} variant="warning" />
                  <ListCard title="Suggestions" items={analysis.suggestions} variant="neutral" />
                  <ListCard title="Technical Skills" items={analysis.technicalSkills} variant="neutral" />
                  <ListCard title="Soft Skills" items={analysis.softSkills} variant="neutral" />
                  <ListCard title="Relevant Experience" items={analysis.relevantExperience} variant="neutral" />
                  <ListCard title="Achievements" items={analysis.achievements} variant="positive" />
                  <ListCard title="Projects" items={analysis.projects} variant="neutral" />
                  <ListCard title="Formatting Notes" items={analysis.formatting} variant="neutral" />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={runAnalysis}>Re-analyze</Button>
                  <Button className="gap-2" onClick={() => { if (!prep) runPrep(); }}>
                    Generate Interview Prep <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </TabsContent>

          {/* PREP TAB */}
          <TabsContent value="prep">
            {loading === 'prep' && !prep ? (
              <LoadingCard label="Generating interview questions and model answers…" />
            ) : prep ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <PrepSection title="Behavioral Questions" icon="behavioral" questions={prep.behavioralQuestions} />
                <PrepSection title="Technical Questions" icon="technical" questions={prep.technicalQuestions} />
                <PrepSection title="Company-Specific Questions" icon="company" questions={prep.companyQuestions} />
                <PrepSection title="Weakness Questions" icon="weakness" questions={prep.weaknessQuestions} />
                <PrepSection title="Strength Questions" icon="strength" questions={prep.strengthQuestions} />

                {/* STAR Examples */}
                <Card className="glass border-0 shadow-lg">
                  <CardHeader><CardTitle className="text-lg">STAR Examples</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {prep.starExamples.map((star, i) => (
                      <div key={i} className="rounded-xl border border-border p-4">
                        <div className="grid gap-2 text-sm">
                          <div><span className="font-semibold text-primary">Situation:</span> {star.situation}</div>
                          <div><span className="font-semibold text-primary">Task:</span> {star.task}</div>
                          <div><span className="font-semibold text-primary">Action:</span> {star.action}</div>
                          <div><span className="font-semibold text-primary">Result:</span> {star.result}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button size="lg" className="gap-2 rounded-full" onClick={() => router.push('/interview')}>
                    Enter Interview Mode <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <Card className="glass border-0 shadow-lg">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Brain className="mb-4 h-12 w-12 text-primary" />
                  <p className="mb-4 text-muted-foreground">Generate interview questions and model answers.</p>
                  <Button onClick={runPrep} className="gap-2">
                    Generate Prep <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    // Simulate realistic AI loading progress
    const duration = 8000;
    const interval = 100;
    const steps = duration / interval;
    
    const getProgress = (step: number) => {
      const ratio = step / steps;
      if (ratio < 0.3) {
        return ratio * 2.5;
      } else if (ratio < 0.7) {
        return 30 + (ratio - 0.3) * 1.5;
      } else {
        return 60 + (ratio - 0.7) * 3.3;
      }
    };

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const targetProgress = Math.min(getProgress(step), 99);
      setProgress(targetProgress);
      
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const ratio = Math.min(elapsed / interval, 1);
        const easeOut = 1 - Math.pow(1 - ratio, 3);
        const current = Math.round(displayProgress + (targetProgress - displayProgress) * easeOut);
        setDisplayProgress(current);
        
        if (ratio < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
      
      if (step >= steps) {
        clearInterval(timer);
        setProgress(99);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="glass relative overflow-hidden border-0 shadow-2xl">
      <CardContent className="flex flex-col items-center justify-center py-24 text-center">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
            animate={{
              x: [0, 100, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
            animate={{
              x: [0, -100, 0],
              y: [0, -50, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Animated circular progress */}
          <div className="relative mb-8">
            {/* Outer rotating ring */}
            <motion.div
              className="absolute inset-0 h-40 w-40"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <div className="h-full w-full rounded-full border-2 border-dashed border-primary/30" />
            </motion.div>

            {/* Middle pulsing ring */}
            <motion.div
              className="absolute inset-2 h-36 w-36 rounded-full border-2 border-primary/50"
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Inner glowing circle */}
            <motion.div
              className="absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-xl"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(var(--primary), 0.3)",
                  "0 0 40px rgba(var(--primary), 0.5)",
                  "0 0 20px rgba(var(--primary), 0.3)"
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {/* Percentage counter */}
              <div className="flex flex-col items-center">
                <motion.div
                  key={displayProgress}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-bold text-primary"
                >
                  {displayProgress}
                </motion.div>
                <div className="text-sm font-medium text-muted-foreground">percent</div>
              </div>
            </motion.div>

            {/* Floating sparkles */}
            <motion.div
              className="absolute -top-4 -right-4"
              animate={{
                y: [0, -10, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 0
              }}
            >
              <Sparkles className="h-6 w-6 text-primary" />
            </motion.div>
            <motion.div
              className="absolute -bottom-4 -left-4"
              animate={{
                y: [0, -10, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 1
              }}
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="mb-6 h-2 w-64 overflow-hidden rounded-full bg-muted/50 backdrop-blur">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/70"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {/* Loading text with animated dots */}
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <motion.div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Status text */}
          <motion.p
            className="mt-4 text-xs text-muted-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {progress < 30 && "Initializing AI analysis..."}
            {progress >= 30 && progress < 60 && "Analyzing resume content..."}
            {progress >= 60 && progress < 90 && "Generating insights..."}
            {progress >= 90 && "Almost done..."}
          </motion.p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'text-emerald-500' : value >= 50 ? 'text-amber-500' : 'text-destructive';
  return (
    <Card className="glass border-0 shadow-lg">
      <CardContent className="p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`text-3xl font-bold ${color}`}>{Math.round(value)}</div>
        <Progress value={value} className="mt-2 h-1.5" />
      </CardContent>
    </Card>
  );
}

function ListCard({ title, items, variant }: { title: string; items: string[]; variant: 'positive' | 'warning' | 'neutral' }) {
  const dot = variant === 'positive' ? 'bg-emerald-500' : variant === 'warning' ? 'bg-amber-500' : 'bg-primary';
  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None identified.</p> : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PrepSection({ title, icon, questions }: { title: string; icon: string; questions: { id: string; question: string; suggestedAnswer: string; keyPoints: string[]; type: string }[] }) {
  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {questions.map((q, i) => (
          <details key={q.id ?? i} className="group rounded-xl border border-border p-4">
            <summary className="flex cursor-pointer items-start gap-2 text-sm font-medium">
              <Badge variant="secondary" className="shrink-0 capitalize">{q.type}</Badge>
              <span>{q.question}</span>
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">{q.suggestedAnswer}</p>
              {q.keyPoints?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {q.keyPoints.map((p, j) => <Badge key={j} variant="outline" className="text-xs">{p}</Badge>)}
                </div>
              )}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
