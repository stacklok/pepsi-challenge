'use client';

import { ThemeProviderContext } from '@/lib/context/theme';
import type { Theme } from '@/types/theme';
import { useEffect, useState } from 'react';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const getTheme = (storageKey: string, defaultTheme: Theme): Theme => {
  if (typeof window === 'undefined') {
    return defaultTheme;
  }
  return (window.localStorage.getItem(storageKey) as Theme) || defaultTheme;
};

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'pepsi-challenge-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    getTheme(storageKey, defaultTheme),
  );
  const [selected, setSelected] = useState<Omit<Theme, 'system'>>();

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      setSelected(systemTheme);
      root.classList.add(systemTheme);
      return;
    }

    setSelected(theme);
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    selected,
    setTheme: (theme: Theme) => {
      window?.localStorage?.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
