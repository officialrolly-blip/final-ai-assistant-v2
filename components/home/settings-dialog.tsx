'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor, Loader2, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCopilotStore } from '@/lib/store';
import { useTheme } from '@/components/providers/theme-provider';
import { FREE_MODELS } from '@/lib/ai/models';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const settings = useCopilotStore((s) => s.settings);
  const update = useCopilotStore((s) => s.updateSettings);
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<{ openRouter: boolean; deepgram: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open && !status) {
      setChecking(true);
      fetch('/api/config')
        .then((r) => r.json())
        .then((d) => setStatus({ openRouter: d.hasOpenRouter, deepgram: d.hasDeepgram }))
        .catch(() => setStatus({ openRouter: false, deepgram: false }))
        .finally(() => setChecking(false));
    }
  }, [open, status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your AI models, appearance, and teleprompter.</DialogDescription>
        </DialogHeader>

        {/* API Key Status */}
        <div className="space-y-2 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> API Key Status
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">OpenRouter</span>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.openRouter
              ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Connected</span>
              : <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Not set</span>}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Deepgram</span>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.deepgram
              ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Connected</span>
              : <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Not set</span>}
          </div>
          {(!status?.openRouter || !status?.deepgram) && (
            <p className="text-xs text-muted-foreground">
              Add OPENROUTER_API_KEY and DEEPGRAM_API_KEY to your <code className="rounded bg-muted px-1">.env</code> file.
            </p>
          )}
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label>OpenRouter Model</Label>
          <Select value={settings.openRouterModel} onValueChange={(v) => update({ openRouterModel: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (best free model)</SelectItem>
              {FREE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={theme === 'dark' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-4 w-4" /> Dark
            </Button>
            <Button
              type="button"
              variant={theme === 'light' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setTheme('light')}
            >
              <Sun className="h-4 w-4" /> Light
            </Button>
          </div>
        </div>

        {/* Teleprompter */}
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="text-sm font-medium">Teleprompter</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font Size ({settings.teleprompterFontSize}px)</Label>
            </div>
            <Slider
              min={16} max={48} step={1}
              value={[settings.teleprompterFontSize]}
              onValueChange={([v]) => update({ teleprompterFontSize: v })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opacity ({Math.round(settings.teleprompterOpacity * 100)}%)</Label>
            </div>
            <Slider
              min={0.3} max={1} step={0.05}
              value={[settings.teleprompterOpacity]}
              onValueChange={([v]) => update({ teleprompterOpacity: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Auto-scroll</Label>
            <Switch checked={settings.teleprompterAutoScroll} onCheckedChange={(v) => update({ teleprompterAutoScroll: v })} />
          </div>
        </div>

        {/* Misc */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Streaming Speed ({settings.streamingSpeed} wpm)</Label>
            <Slider
              min={20} max={120} step={5}
              value={[settings.streamingSpeed]}
              onValueChange={([v]) => update({ streamingSpeed: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Also capture microphone</Label>
            <Switch checked={settings.useMic} onCheckedChange={(v) => update({ useMic: v })} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
