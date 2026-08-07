'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCopilotStore } from '@/lib/store';
import type { InterviewType } from '@/lib/types';
import { toast } from 'sonner';

const schema = z.object({
  role: z.string().min(1, 'Job role is required'),
  company: z.string().min(1, 'Company name is required'),
  description: z.string().min(20, 'Please paste the full job description'),
  interviewType: z.enum(['technical', 'behavioral', 'hr', 'mixed']),
});

type FormData = z.infer<typeof schema>;

const INTERVIEW_TYPES: { value: InterviewType; label: string; desc: string }[] = [
  { value: 'technical', label: 'Technical', desc: 'Coding, system design, problem-solving' },
  { value: 'behavioral', label: 'Behavioral', desc: 'STAR-format past experiences' },
  { value: 'hr', label: 'HR', desc: 'Background, motivation, logistics' },
  { value: 'mixed', label: 'Mixed', desc: 'All of the above' },
];

export function JobForm({ onBack, onAnalyze }: { onBack: () => void; onAnalyze: () => void }) {
  const job = useCopilotStore((s) => s.job);
  const setJob = useCopilotStore((s) => s.setJob);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: job ?? { interviewType: 'mixed' },
  });

  const selectedType = watch('interviewType');

  const onSubmit = (data: FormData) => {
    setJob(data);
    toast.success('Job info saved');
    onAnalyze();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">1</span>
          <span className="h-px w-8 bg-border" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
          <span className="h-px w-8 bg-border" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">3</span>
        </div>
      </div>

      <h2 className="mb-2 text-2xl font-bold tracking-tight">Job information</h2>
      <p className="mb-6 text-muted-foreground">Tell the copilot what role you&apos;re interviewing for.</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="glass mb-4 border-0 shadow-lg">
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">Job Role</Label>
                <Input id="role" placeholder="e.g. Senior Frontend Engineer" {...register('role')} />
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input id="company" placeholder="e.g. Stripe" {...register('company')} />
                {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Job Description</Label>
              <Textarea
                id="description"
                rows={6}
                placeholder="Paste the full job description here…"
                className="resize-none"
                {...register('description')}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Interview Type</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {INTERVIEW_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue('interviewType', t.value, { shouldValidate: true })}
                    className={`relative rounded-xl border p-3 text-left transition-all ${
                      selectedType === t.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Briefcase className={`mb-1.5 h-4 w-4 ${selectedType === t.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="gap-2 rounded-full">
            Analyze Resume <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
