// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Faction Theme Selector
// Dropdown for switching Dawn of War heraldry palettes
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ALL_FACTION_PALETTES } from '@forceorg/ui-theme';
import { ChapterIcon, CHAPTER_PATHS } from '@forceorg/ui-theme';
import type { ChapterKey } from '@forceorg/ui-theme';

export interface FactionSelectorProps {
  currentTheme: string;
  onThemeChange: (key: string) => void;
}

export const FactionSelector: React.FC<FactionSelectorProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const currentPalette = ALL_FACTION_PALETTES.find(p => p.key === currentTheme);
  const isChapter = currentTheme in CHAPTER_PATHS;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredPalettes = ALL_FACTION_PALETTES.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.75rem',
          background: 'rgba(15, 20, 28, 0.85)',
          border: '1px solid var(--surface-border, #334155)',
          borderRadius: 'var(--radius-md, 6px)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {/* Color Preview Dots */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {currentPalette && (
            <>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentPalette.primary }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentPalette.trim }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentPalette.glow }} />
            </>
          )}
        </div>
        {isChapter && <ChapterIcon chapter={currentTheme as ChapterKey} size={16} color="var(--c-trim)" />}
        <span>{currentPalette?.name || currentTheme}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: 300,
            maxHeight: 420,
            overflow: 'auto',
            background: 'rgba(15, 20, 28, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
            zIndex: 200,
            animation: 'fadeIn 150ms ease',
          }}
        >
          {/* Search */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>
            <input
              type="text"
              placeholder="Search factions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '0.375rem 0.625rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Faction List */}
          <div style={{ padding: '0.25rem' }}>
            {filteredPalettes.map(palette => {
              const isActive = palette.key === currentTheme;
              const hasChapter = palette.key in CHAPTER_PATHS;
              return (
                <button
                  key={palette.key}
                  onClick={() => {
                    onThemeChange(palette.key);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.5rem 0.625rem',
                    background: isActive ? 'rgba(200, 157, 60, 0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(200, 157, 60, 0.3)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm, 4px)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 100ms ease',
                  }}
                >
                  {/* Color Swatch */}
                  <div style={{
                    display: 'flex',
                    gap: '1px',
                    flexShrink: 0,
                  }}>
                    <div style={{ width: 14, height: 20, background: palette.primary, borderRadius: '2px 0 0 2px' }} />
                    <div style={{ width: 7, height: 20, background: palette.secondary }} />
                    <div style={{ width: 7, height: 20, background: palette.trim }} />
                    <div style={{ width: 7, height: 20, background: palette.detail }} />
                    <div style={{ width: 7, height: 20, background: palette.glow, borderRadius: '0 2px 2px 0' }} />
                  </div>

                  {hasChapter && (
                    <ChapterIcon chapter={palette.key as ChapterKey} size={16} color={palette.trim} />
                  )}

                  <span style={{ fontWeight: isActive ? 700 : 400 }}>{palette.name}</span>
                </button>
              );
            })}

            {filteredPalettes.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No factions found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
