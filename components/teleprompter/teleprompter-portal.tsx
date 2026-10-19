'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Pause, Play, GripVertical, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopilotStore } from '@/lib/store';
import { extractPartialString } from '@/lib/ai/client';
import { useTheme } from '@/components/providers/theme-provider';

function TeleprompterWindow({ children }: { children: React.ReactNode }) {
  const teleprompterOpen = useCopilotStore((s) => s.teleprompterOpen);
  const setTeleprompterOpen = useCopilotStore((s) => s.setTeleprompterOpen);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const externalWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (!teleprompterOpen) {
      if (externalWindow.current && !externalWindow.current.closed) {
        externalWindow.current.close();
      }
      externalWindow.current = null;
      setContainer(null);
      setBlocked(false);
      return;
    }

    if (externalWindow.current && !externalWindow.current.closed) {
      externalWindow.current.focus();
      return;
    }

    const newWindow = window.open('', 'Teleprompter', 'width=540,height=420,left=100,top=100');
    if (!newWindow) {
      setBlocked(true);
      return;
    }

    externalWindow.current = newWindow;
    newWindow.document.title = 'Teleprompter';
    newWindow.document.body.style.margin = '0';
    newWindow.document.body.style.minHeight = '100vh';
    newWindow.document.body.style.background = 'transparent';

    const containerEl = newWindow.document.createElement('div');
    newWindow.document.body.appendChild(containerEl);
    setContainer(containerEl);

    const styleNodes = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'));
    styleNodes.forEach((node) => newWindow.document.head.appendChild(node.cloneNode(true)));

    const handleUnload = () => {
      setContainer(null);
      setTeleprompterOpen(false);
    };
    newWindow.addEventListener('beforeunload', handleUnload);

    return () => {
      newWindow.removeEventListener('beforeunload', handleUnload);
      if (!newWindow.closed) newWindow.close();
    };
  }, [teleprompterOpen, setTeleprompterOpen]);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 text-center text-white">
        <div className="rounded-2xl bg-slate-950/90 p-6 shadow-2xl">
          <h2 className="text-lg font-semibold">Teleprompter popup blocked</h2>
          <p className="mt-2 text-sm text-slate-300">
            Please allow popups for this app. The teleprompter opens in a separate window so it stays private while sharing your browser tab.
          </p>
        </div>
      </div>
    );
  }

  if (!container) return null;
  return createPortal(children, container);
}

export function TeleprompterPortal() {
  return (
    <TeleprompterWindow>
      <Teleprompter />
    </TeleprompterWindow>
  );
}

function Teleprompter() {
  const settings = useCopilotStore((s) => s.settings);
  const update = useCopilotStore((s) => s.updateSettings);
  const currentAnswer = useCopilotStore((s) => s.currentAnswer);
  const turns = useCopilotStore((s) => s.turns);
  const { theme } = useTheme();

  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState({ x: 40, y: 80 });
  const [size, setSize] = useState({ w: 520, h: 340 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const userScrolledAway = useRef(false);

  const latestAssistant = [...turns].reverse().find((t) => t.role === 'assistant');
  const latestAnswer = latestAssistant?.answer;
  // While an answer is streaming, currentAnswer is raw JSON — extract the clean
  // professional response so the teleprompter shows readable text in real time.
  // Once finished, prefer the finalized professional response from the turn.
  const streamingText = currentAnswer
    ? (extractPartialString(currentAnswer, 'professionalResponse') || extractPartialString(currentAnswer, 'shortVersion'))
    : '';
  const displayText =
    streamingText ||
    latestAnswer?.professionalResponse ||
    latestAnswer?.shortVersion ||
    latestAssistant?.content ||
    '';

  const scrollRef = useRef<HTMLDivElement>(null);

  // Remember when the reader scrolls up so streaming doesn't yank them back down.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledAway.current = el.scrollHeight - el.scrollTop - el.clientHeight > 48;
  }, []);

  // Follow new text only when auto-scroll is enabled, playback isn't paused,
  // and the user hasn't scrolled away from the bottom on their own.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused || !settings.teleprompterAutoScroll || userScrolledAway.current) return;
    el.scrollTop = el.scrollHeight;
  }, [displayText, paused, settings.teleprompterAutoScroll]);

  // Toggling auto-scroll back on re-anchors to the latest line.
  useEffect(() => {
    if (!settings.teleprompterAutoScroll) return;
    userScrolledAway.current = false;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [settings.teleprompterAutoScroll]);

  useEffect(() => {
    if (displayText) setVisible(true);
  }, [displayText]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
      });
    };
    const up = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(280, resizeRef.current.ow + (e.clientX - resizeRef.current.sx)),
        h: Math.max(160, resizeRef.current.oh + (e.clientY - resizeRef.current.sy)),
      });
    };
    const up = () => { setResizing(false); resizeRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [resizing]);

  const toggleVisible = useCallback(() => setVisible((v) => !v), []);
  useEffect(() => {
    // Listen on the window that actually hosts the teleprompter (the popup
    // window when open) so shortcuts work while the popup is focused.
    const win = rootRef.current?.ownerDocument.defaultView;
    if (!win) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); toggleVisible(); }
      else if (e.key === ' ' && visible) { e.preventDefault(); setPaused((p) => !p); }
      else if (e.ctrlKey && e.key === 'ArrowUp') { e.preventDefault(); update({ teleprompterFontSize: Math.min(48, settings.teleprompterFontSize + 2) }); }
      else if (e.ctrlKey && e.key === 'ArrowDown') { e.preventDefault(); update({ teleprompterFontSize: Math.max(16, settings.teleprompterFontSize - 2) }); }
    };
    win.addEventListener('keydown', handler);
    return () => win.removeEventListener('keydown', handler);
  }, [visible, toggleVisible, update, settings.teleprompterFontSize]);

  const isDark = theme === 'dark';

  return (
    <div ref={rootRef}>
      <AnimatePresence>
        {!visible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setVisible(true)}
            className="fixed bottom-6 right-6 z-[9998] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:scale-105"
            title="Show Teleprompter (Ctrl+T)"
          >
            <Eye className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              left: pos.x,
              top: pos.y,
              width: size.w,
              height: size.h,
            }}
            className="fixed z-[9999] flex flex-col"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
          >
            {/* Backdrop scrim only — the opacity setting dims this, never the text. */}
            <div
              onMouseDown={(e) => {
                setDragging(true);
                dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
              }}
              className="absolute inset-0"
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)',
                opacity: settings.teleprompterOpacity,
              }}
            />

            {/* Floating controls — appear on hover instead of a boxed header. */}
            <div
              className={`absolute left-1/2 top-0 z-20 -translate-x-1/2 transition-opacity duration-200 ${
                showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div
                onMouseDown={(e) => {
                  setDragging(true);
                  dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
                }}
                className={`mt-2 flex cursor-move items-center gap-1 rounded-full border px-2 py-1 shadow-lg backdrop-blur-xl ${
                  isDark ? 'border-white/10 bg-black/60 text-zinc-100' : 'border-black/10 bg-white/80 text-zinc-900'
                }`}
              >
                <GripVertical className="h-4 w-4 opacity-40" />
                {latestAnswer?.isAdlib && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    ad-lib
                  </span>
                )}
                {latestAnswer && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary capitalize">
                    {latestAnswer.questionType}
                  </span>
                )}
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setPaused((p) => !p)}
                  title={paused ? 'Play (Space)' : 'Pause (Space)'}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => update({ teleprompterFontSize: Math.max(16, settings.teleprompterFontSize - 2) })}
                  title="Decrease font (Ctrl+↓)"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => update({ teleprompterFontSize: Math.min(48, settings.teleprompterFontSize + 2) })}
                  title="Increase font (Ctrl+↑)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setVisible(false)}
                  title="Hide (Ctrl+T)"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-12"
            >
              {displayText ? (
                <p
                  style={{
                    fontSize: `${settings.teleprompterFontSize}px`,
                    lineHeight: 1.5,
                    textShadow: isDark
                      ? '0 1px 4px rgba(0,0,0,0.85)'
                      : '0 1px 4px rgba(255,255,255,0.85)',
                  }}
                  className={`font-medium ${isDark ? 'text-zinc-50' : 'text-zinc-900'}`}
                >
                  {displayText}
                  {paused && <span className="ml-2 text-xs text-amber-500">[paused]</span>}
                </p>
              ) : (
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Waiting for the interviewer&apos;s question…
                </p>
              )}
            </div>

            {/* Resize grip */}
            <div
              onMouseDown={(e) => {
                setResizing(true);
                resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: size.w, oh: size.h };
              }}
              className={`absolute bottom-0 right-0 z-20 h-5 w-5 cursor-nwse-resize border-b-2 border-r-2 ${
                isDark ? 'border-white/20' : 'border-black/20'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
