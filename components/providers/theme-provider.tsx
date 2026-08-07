'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useCopilotStore } from '@/lib/store';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'dark',
}: {
  children: React.ReactNode;
  attribute: string;
  defaultTheme: Theme;
  enableSystem?: boolean;
}) {
  const settingsTheme = useCopilotStore((s) => s.settings.theme);
  const setStoreTheme = useCopilotStore((s) => s.setTheme);
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // Sync from persisted store once hydrated
  useEffect(() => {
    setThemeState(settingsTheme);
  }, [settingsTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    } else {
      root.setAttribute(attribute, theme);
    }
  }, [theme, attribute]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    setStoreTheme(t);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
