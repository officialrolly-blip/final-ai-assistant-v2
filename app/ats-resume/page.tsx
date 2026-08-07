'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResumeUploader } from '@/components/home/resume-uploader';
import { useCopilotStore } from '@/lib/store';
import { streamChat, extractJson } from '@/lib/ai/client';
import type { ResumeAnalysis } from '@/lib/types';
import { toast } from 'sonner';

interface ATSResumeResult {
  improvedResume: string;
  notes: string;
}

export default function ATSResumePage() {
  const router = useRouter();
  const resume = useCopilotStore((s) => s.resume);
  const setResume = useCopilotStore((s) => s.setResume);
  const modelSetting = useCopilotStore((s) => s.settings.openRouterModel);

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [atsResume, setAtsResume] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<'analysis' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resume) {
      setStep('upload');
      setAnalysis(null);
      setAtsResume(null);
      setError(null);
    }
  }, [resume]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const resetFlow = () => {
    setAnalysis(null);
    setAtsResume(null);
    setError(null);
    setDownloadUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  };

  const handleAnalyze = async () => {
    if (!resume) return;
    resetFlow();
    setLoading('analysis');

    let raw = '';
    const messages = [
      {
        role: 'user' as const,
        content: `RESUME:\n${resume.text}\n\nINSTRUCTIONS: Analyze this resume for ATS compatibility, clarity, formatting, and keyword usage. Provide scores and actionable suggestions. Return ONLY valid JSON with this schema:\n{\n  "overallScore": number (0-100),\n  "atsCompatibility": number (0-100),\n  "resumeQuality": number (0-100),\n  "keywordMatch": number (0-100),\n  "missingSkills": string[],\n  "technicalSkills": string[],\n  "softSkills": string[],\n  "relevantExperience": string[],\n  "projects": string[],\n  "achievements": string[],\n  "formatting": string[],\n  "grammar": string[],\n  "strengths": string[],\n  "weaknesses": string[],\n  "suggestions": string[],\n  "summary": string\n}`,
      },
    ];

    const res = await streamChat({
      task: 'analyze-resume',
      messages,
      model: modelSetting,
      onToken: (chunk) => {
        raw += chunk;
      },
    });

    if (!res.ok) {
      if (res.error?.includes('HTTP 429')) {
        setError('The AI service is rate limited right now. Please wait a few seconds and try again.');
      } else {
        setError(res.error ?? 'Analysis failed.');
      }
      setLoading(null);
      return;
    }

    const parsed = extractJson<ResumeAnalysis>(raw);
    if (!parsed) {
      setError('Could not parse AI response. Try again.');
      setLoading(null);
      return;
    }

    setAnalysis(parsed);
    setLoading(null);
    toast.success('Resume analysis complete');
  };

  const tryParseAtsResume = (raw: string): ATSResumeResult | null => {
    const parsed = extractJson<ATSResumeResult>(raw);
    if (parsed && parsed.improvedResume) return parsed;

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const candidate = match[0]
      .replace(/```json|```/gi, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    try {
      return JSON.parse(candidate) as ATSResumeResult;
    } catch {
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!resume) return;
    if (!analysis) {
      setError('Please analyze your resume first.');
      return;
    }
    resetFlow();
    setLoading('generate');
    setError(null);

    let raw = '';
    const messages = [
      {
        role: 'user' as const,
        content: `RESUME:\n${resume.text}\n\nANALYSIS SUMMARY:\n${analysis.summary}\n\nSUGGESTIONS:\n${analysis.suggestions.join('; ')}\n\nINSTRUCTIONS: Rewrite this resume into a polished ATS-friendly resume. Keep the candidate's experience, achievements, and keywords intact. Use a clear ATS resume structure with headings, concise bullet points, and quantifiable results. Return ONLY valid JSON with this schema:\n{\n  "improvedResume": string,\n  "notes": string\n}\nDo not include markdown fences or explanations.`,
      },
    ];

    const res = await streamChat({
      task: 'generate-ats-resume',
      messages,
      model: modelSetting,
      onToken: (chunk) => {
        raw += chunk;
      },
    });

    if (!res.ok) {
      if (res.error?.includes('HTTP 429')) {
        setError('The AI service is rate limited right now. Please wait a few seconds and try again.');
      } else {
        setError(res.error ?? 'Resume generation failed.');
      }
      setLoading(null);
      return;
    }

    const parsed = tryParseAtsResume(raw);
    if (!parsed || !parsed.improvedResume) {
      console.error('ATS parse failed raw:', raw);
      setError('Could not parse generated resume. Try again.');
      setLoading(null);
      return;
    }

    setAtsResume(parsed.improvedResume.trim());
    setLoading(null);
    toast.success('ATS resume generated');
    await generatePdf(parsed.improvedResume.trim());
  };

  const generatePdf = async (content: string) => {
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const margin = 50;
      const fontSize = 11;
      const lineHeight = fontSize * 1.4;
      const pageWidth = 612;
      const pageHeight = 792;

      let page = doc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      const lines = content.split(/\r?\n/).flatMap((line) => {
        const words = line.trim().split(/\s+/);
        const maxWidth = pageWidth - margin * 2;
        const wrapped: string[] = [];
        let current = '';
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(candidate, fontSize);
          if (textWidth > maxWidth && current) {
            wrapped.push(current);
            current = word;
          } else {
            current = candidate;
          }
        }
        if (current) wrapped.push(current);
        return wrapped.length ? wrapped : [''];
      });

      for (const line of lines) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, {
          x: margin,
          y: y - fontSize,
          size: fontSize,
          font,
          color: rgb(0.07, 0.07, 0.07),
          lineHeight,
          maxWidth: pageWidth - margin * 2,
        });
        y -= lineHeight;
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl((existing) => {
        if (existing) URL.revokeObjectURL(existing);
        return url;
      });
    } catch (err) {
      setError('PDF generation failed.');
    }
  };

  const handleReset = () => {
    setResume(null);
    setStep('upload');
    resetFlow();
  };

  return (
    <div className="relative min-h-screen bg-background bg-aurora">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/') }>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Home
          </Button>
          {resume && (
            <Badge variant="secondary" className="hidden items-center gap-1.5 sm:flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Resume ready
            </Badge>
          )}
        </div>
        <Button size="sm" className="gap-2 rounded-full" onClick={handleReset}>
          Start over <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Improve your ATS Resume</h1>
          <p className="mt-1 text-muted-foreground">
            Upload your resume, check it now, and generate a polished ATS-formatted PDF version.
          </p>
        </div>

        {error && (
          <Card className="glass mb-6 border-0 shadow-lg">
            <CardContent className="flex items-center gap-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {step === 'upload' && (
          <div className="space-y-6">
            <ResumeUploader onBack={() => router.push('/')} onNext={() => { setStep('review'); handleAnalyze(); }} nextLabel="Check it now" />
            {resume && !analysis && loading === 'analysis' && (
              <LoadingCard label="Analyzing your resume for ATS compatibility…" />
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            {resume && (
              <Card className="glass border-0 shadow-lg">
                <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Resume</p>
                    <p className="text-lg font-semibold">{resume.fileName}</p>
                    <p className="text-sm text-muted-foreground">{Math.round(resume.sizeBytes / 1024)} KB · {resume.fileType.toUpperCase()}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading === 'analysis'}>
                      {loading === 'analysis' ? 'Re-checking…' : 'Check it now'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                      Change resume
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading === 'analysis' && !analysis ? (
              <LoadingCard label="Analyzing your resume for ATS compatibility…" />
            ) : analysis ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  <ResultCard label="ATS" value={analysis.atsCompatibility} />
                  <ResultCard label="Overall" value={analysis.overallScore} />
                  <ResultCard label="Quality" value={analysis.resumeQuality} />
                  <ResultCard label="Keyword Match" value={analysis.keywordMatch} />
                </div>

                <Card className="glass border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailList title="Suggestions" items={analysis.suggestions} />
                  <DetailList title="Formatting & Grammar" items={[...analysis.formatting, ...analysis.grammar]} />
                  <DetailList title="Missing Skills" items={analysis.missingSkills} />
                  <DetailList title="Strengths" items={analysis.strengths} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={handleAnalyze} disabled={loading === 'analysis'}>
                    {loading === 'analysis' ? 'Re-checking…' : 'Re-analyze'}
                  </Button>
                  <Button size="lg" className="gap-2" onClick={handleGenerate} disabled={loading === 'generate'}>
                    {loading === 'generate' ? 'Generating…' : 'Generate your ATS resume'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {loading === 'generate' && <LoadingCard label="Generating your ATS-ready resume…" />}

            {atsResume && (
              <Card className="glass border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">ATS Resume Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">A polished ATS-friendly resume has been generated and is ready for download.</p>
                  <pre className="rounded-xl border border-border bg-muted p-4 text-sm whitespace-pre-wrap">{atsResume}</pre>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={downloadUrl ?? '#'}
                      download={`ATS-${resume?.fileName ?? 'resume'}.pdf`}
                      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 ${!downloadUrl ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      <Download className="h-4 w-4" /> Download ATS Resume
                    </a>
                    <Button variant="outline" size="lg" onClick={handleGenerate} disabled={loading === 'generate'}>
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="glass flex flex-col items-center border-0 py-16 text-center shadow-lg">
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

function ResultCard({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'text-emerald-500' : value >= 50 ? 'text-amber-500' : 'text-destructive';
  return (
    <Card className="glass border-0 shadow-lg">
      <CardContent className="p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`text-3xl font-bold ${color}`}>{Math.round(value)}</div>
      </CardContent>
    </Card>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None identified.</p>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {items.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
