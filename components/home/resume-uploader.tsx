'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle2, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useCopilotStore } from '@/lib/store';
import type { ParsedResume } from '@/lib/types';

export function ResumeUploader({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  const setResume = useCopilotStore((s) => s.setResume);
  const existing = useCopilotStore((s) => s.resume);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.txt')) {
      toast.error('Unsupported format', { description: 'Please upload a PDF, DOCX, or TXT file.' });
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-resume', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse');
      setResume(data as ParsedResume);
      toast.success('Resume parsed', { description: `${data.fileName} ready for analysis.` });
    } catch (err) {
      toast.error('Parsing failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setParsing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
          <span className="h-px w-8 bg-border" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</span>
          <span className="h-px w-8 bg-border" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">3</span>
        </div>
      </div>

      <h2 className="mb-2 text-2xl font-bold tracking-tight">Upload your resume</h2>
      <p className="mb-6 text-muted-foreground">PDF, DOCX, or TXT. Parsed locally — nothing leaves your machine except the AI calls.</p>

      <Card className="glass border-0 shadow-lg">
        <CardContent className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <AnimatePresence mode="wait">
              {parsing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">Parsing resume…</p>
                </motion.div>
              ) : existing ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="font-medium">{existing.fileName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Math.round(existing.sizeBytes / 1024)} KB · {existing.fileType.toUpperCase()} · {existing.text.split(/\s+/).length} words
                  </p>
                  <Button variant="ghost" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); setResume(null); }}>
                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium">Drop your resume here</p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {existing && (
        <div className="mt-6 flex justify-end">
          <Button size="lg" className="gap-2 rounded-full" onClick={onNext}>
            {nextLabel ?? 'Continue'} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
