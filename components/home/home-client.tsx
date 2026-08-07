'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText, Briefcase, Settings, Zap, Mic, Brain, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResumeUploader } from '@/components/home/resume-uploader';
import { JobForm } from '@/components/home/job-form';
import { SettingsDialog } from '@/components/home/settings-dialog';
import { useCopilotStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

type Step = 'landing' | 'resume' | 'job';

export function HomeClient() {
  const [step, setStep] = useState<Step>('landing');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resume = useCopilotStore((s) => s.resume);
  const job = useCopilotStore((s) => s.job);
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-aurora">
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-400 shadow-lg shadow-primary/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Interview Copilot</span>
        </div>
        <div className="flex items-center gap-2">
          {resume && (
            <Badge variant="secondary" className="hidden gap-1.5 sm:flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Resume loaded
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1.5 h-4 w-4" /> Settings
          </Button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 'landing' && (
          <motion.section
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 text-center sm:pt-24"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Real-time AI interview assistant</span>
            </motion.div>

            <h1 className="max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
              Ace every interview with an{' '}
              <span className="text-gradient">AI copilot</span> by your side
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Upload your resume, add the job details, and get instant AI-generated answers during
              live interviews — transcribed in real time from the interviewer&apos;s voice.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-14 gap-2 rounded-full px-8 text-base shadow-xl shadow-primary/25"
                onClick={() => setStep('resume')}
              >
                <Zap className="h-5 w-5" /> Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 gap-2 rounded-full px-8 text-base"
                onClick={() => router.push('/ats-resume')}
              >
                Improve your ATS Resume
              </Button>
              {resume && job && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 gap-2 rounded-full px-8 text-base"
                  onClick={() => router.push('/analyze')}
                >
                  Resume loaded — Continue <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Feature cards */}
            <div className="mt-20 grid w-full gap-5 sm:grid-cols-3">
              {[
                { icon: FileText, title: 'Resume Analysis', desc: 'ATS scoring, skill gaps, and tailored suggestions' },
                { icon: Brain, title: 'Interview Prep', desc: 'Likely questions, STAR examples, and model answers' },
                { icon: Mic, title: 'Live Copilot', desc: 'Real-time transcription with instant AI responses' },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <Card className="glass h-full border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="mb-1.5 text-base font-semibold">{f.title}</h3>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pipeline */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              {['Screen Audio', 'Deepgram', 'Transcript', 'OpenRouter', 'AI Answer', 'Teleprompter'].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="glass rounded-full px-3.5 py-1.5 font-medium text-foreground">{s}</span>
                  {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 opacity-40" />}
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {step === 'resume' && (
          <motion.div
            key="resume"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 mx-auto max-w-2xl px-6 pt-8"
          >
            <ResumeUploader
              onBack={() => setStep('landing')}
              onNext={() => setStep('job')}
            />
          </motion.div>
        )}

        {step === 'job' && (
          <motion.div
            key="job"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 mx-auto max-w-2xl px-6 pt-8"
          >
            <JobForm
              onBack={() => setStep('resume')}
              onAnalyze={() => router.push('/analyze')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
