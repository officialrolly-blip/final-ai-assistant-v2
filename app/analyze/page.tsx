'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, FileText, Brain, AlertCircle } from 'lucide-react';
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
    const parsed = extractJson<ResumeAnalysis>(raw);
    if (!parsed) { setError('Could not parse AI response. Try again.'); setLoading(null); return; }
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
    const parsed = extractJson<InterviewPrep>(raw);
    if (!parsed) { setError('Could not parse AI response. Try again.'); setLoading(null); return; }
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
  return (
    <Card className="glass flex flex-col items-center border-0 py-20 text-center shadow-lg">
      <CardContent>
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">{label}</p>
        <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-shimmer rounded-full" />
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
