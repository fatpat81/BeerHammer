// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — ThemeProvider
// Injects Dawn of War 4-channel CSS tokens based on the active faction/chapter
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { createContext, useContext, useMemo, useCallback, useState } from 'react';
import { getFactionPalette, paletteToCSSVars } from './palettes/factions';
import type { FactionPalette } from '@forceorg/types';

export interface ThemeContextValue {
  palette: FactionPalette;
  themeKey: string;
  setTheme: (key: string) => void;
  cssVars: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}

export interface ThemeProviderProps {
  defaultTheme?: string;
  themeKey?: string;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  defaultTheme = 'ultramarines',
  themeKey: controlledThemeKey,
  children,
}) => {
  const [internalThemeKey, setInternalThemeKey] = useState(controlledThemeKey ?? defaultTheme);
  const themeKey = controlledThemeKey ?? internalThemeKey;

  const palette = useMemo(() => getFactionPalette(themeKey), [themeKey]);
  const cssVars = useMemo(() => paletteToCSSVars(palette), [palette]);

  const setTheme = useCallback((key: string) => {
    setInternalThemeKey(key);
  }, []);

  const value = useMemo(
    () => ({ palette, themeKey, setTheme, cssVars }),
    [palette, themeKey, setTheme, cssVars]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-faction-theme={themeKey}
        style={cssVars as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
