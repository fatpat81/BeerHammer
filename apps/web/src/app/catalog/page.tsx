// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Datasheet Catalog Browser (§12)
// Route: /catalog
// Full database browser with faction, battlefield role, and keyword filters
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ThemeProvider, ChapterIcon, ALL_FACTION_PALETTES } from '@forceorg/ui-theme';
import { FactionSelector } from '@/components/FactionSelector';
import { fetchDatasheets } from '@/lib/api';
import type { Datasheet } from '@forceorg/types';

// Fallback curated catalog for instant presentation
const FALLBACK_CATALOG_DATASHEETS: any[] = [
  {
    id: 'ds-captain-terminator',
    factionId: 'adeptus_astartes',
    name: 'Captain in Terminator Armour',
    battlefieldRole: 'CHARACTER',
    basePoints: 95,
    detachmentPointsCost: 0,
    stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', wounds: 6, leadership: '6+', objectiveControl: 1 },
    keywords: ['INFANTRY', 'CHARACTER', 'EPIC HERO', 'IMPERIUM', 'TERMINATOR', 'CAPTAIN'],
    wargearRulesRaw: "The Captain's storm bolter can be replaced with 1 Combi-weapon or 1 Plasma Pistol\nThe Captain's power weapon can be replaced with 1 Power Fist or 1 Thunder Hammer",
    unitComposition: { models: [{ name: 'Captain in Terminator Armour', count: 1 }] },
  },
  {
    id: 'ds-terminator-squad',
    factionId: 'adeptus_astartes',
    name: 'Terminator Squad',
    battlefieldRole: 'INFANTRY',
    basePoints: 185,
    detachmentPointsCost: 0,
    stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', wounds: 3, leadership: '6+', objectiveControl: 1 },
    keywords: ['INFANTRY', 'IMPERIUM', 'TERMINATOR'],
    wargearRulesRaw: "The Sergeant's storm bolter can be replaced with 1 Combi-weapon\nFor every 5 models, 1 model can replace with 1 Assault Cannon and 1 Power Fist",
    unitComposition: { models: [{ name: 'Terminator Sergeant', count: 1 }, { name: 'Terminator', count: 4 }] },
  },
  {
    id: 'ds-intercessor-squad',
    factionId: 'adeptus_astartes',
    name: 'Intercessor Squad',
    battlefieldRole: 'BATTLELINE',
    basePoints: 75,
    detachmentPointsCost: 0,
    stats: { movement: '6"', toughness: 4, save: '3+', wounds: 2, leadership: '6+', objectiveControl: 2 },
    keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
    wargearRulesRaw: "The Sergeant's bolt rifle can be replaced with 1 Astartes Chainsword or 1 Power Weapon",
    unitComposition: { models: [{ name: 'Intercessor Sergeant', count: 1 }, { name: 'Intercessor', count: 4 }] },
  },
  {
    id: 'ds-assault-intercessors',
    factionId: 'adeptus_astartes',
    name: 'Assault Intercessors',
    battlefieldRole: 'BATTLELINE',
    basePoints: 75,
    detachmentPointsCost: 0,
    stats: { movement: '6"', toughness: 4, save: '3+', wounds: 2, leadership: '6+', objectiveControl: 2 },
    keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
    wargearRulesRaw: "The Sergeant's Astartes chainsword can be replaced with 1 Power Weapon or 1 Thunder Hammer",
    unitComposition: { models: [{ name: 'Assault Intercessor Sergeant', count: 1 }, { name: 'Assault Intercessor', count: 4 }] },
  },
  {
    id: 'ds-eradicator-squad',
    factionId: 'adeptus_astartes',
    name: 'Eradicator Squad',
    battlefieldRole: 'INFANTRY',
    basePoints: 95,
    detachmentPointsCost: 0,
    stats: { movement: '5"', toughness: 6, save: '3+', wounds: 3, leadership: '6+', objectiveControl: 1 },
    keywords: ['INFANTRY', 'IMPERIUM', 'GRAVIS'],
    wargearRulesRaw: "Any model can be equipped with 1 Multi-melta instead of 1 Melta Rifle",
    unitComposition: { models: [{ name: 'Eradicator Sergeant', count: 1 }, { name: 'Eradicator', count: 2 }] },
  },
  {
    id: 'ds-redemptor-dreadnought',
    factionId: 'adeptus_astartes',
    name: 'Redemptor Dreadnought',
    battlefieldRole: 'VEHICLE',
    basePoints: 210,
    detachmentPointsCost: 1,
    stats: { movement: '8"', toughness: 10, save: '2+', wounds: 12, leadership: '6+', objectiveControl: 4 },
    keywords: ['VEHICLE', 'WALKER', 'IMPERIUM', 'DREADNOUGHT'],
    wargearRulesRaw: "The Heavy Flamer can be replaced with 1 Onslaught Gatling Cannon\nThe Macro Plasma Incinerator can be replaced with 1 Heavy Onslaught Gatling Cannon",
    unitComposition: { models: [{ name: 'Redemptor Dreadnought', count: 1 }] },
  },
  {
    id: 'ds-inceptor-squad',
    factionId: 'adeptus_astartes',
    name: 'Inceptor Squad',
    battlefieldRole: 'INFANTRY',
    basePoints: 130,
    detachmentPointsCost: 0,
    stats: { movement: '10"', toughness: 6, save: '3+', wounds: 3, leadership: '6+', objectiveControl: 1 },
    keywords: ['INFANTRY', 'JUMP PACK', 'IMPERIUM', 'GRAVIS', 'FLY'],
    wargearRulesRaw: "All models can replace 2 Assault Bolters with 2 Plasma Exterminators",
    unitComposition: { models: [{ name: 'Inceptor Sergeant', count: 1 }, { name: 'Inceptor', count: 2 }] },
  },
  {
    id: 'ds-land-raider',
    factionId: 'adeptus_astartes',
    name: 'Land Raider',
    battlefieldRole: 'VEHICLE',
    basePoints: 240,
    detachmentPointsCost: 1,
    stats: { movement: '10"', toughness: 12, save: '2+', wounds: 16, leadership: '6+', objectiveControl: 5 },
    keywords: ['VEHICLE', 'TRANSPORT', 'SMOKE', 'IMPERIUM', 'LAND RAIDER'],
    wargearRulesRaw: "Can be equipped with 1 Storm Bolter, 1 Multi-melta, and 1 Hunter-killer Missile",
    unitComposition: { models: [{ name: 'Land Raider', count: 1 }] },
  },
];

const DEFAULT_ROLE_META = { label: 'Infantry', icon: '🎯', color: '#22c55e' };

const ROLE_ICONS: Record<string, { label: string; icon: string; color: string }> = {
  ALL: { label: 'All Roles', icon: '★', color: 'var(--c-trim)' },
  CHARACTER: { label: 'Character', icon: '⚔', color: '#c89d3c' },
  BATTLELINE: { label: 'Battleline', icon: '🛡', color: '#38bdf8' },
  INFANTRY: { label: 'Infantry', icon: '🎯', color: '#22c55e' },
  VEHICLE: { label: 'Vehicle', icon: '🔧', color: '#f97316' },
  MONSTER: { label: 'Monster', icon: '🐉', color: '#a855f7' },
  DEDICATED_TRANSPORT: { label: 'Transport', icon: '🚚', color: '#eab308' },
};

export default function DatasheetCatalogPage() {
  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [datasheets, setDatasheets] = useState<any[]>(FALLBACK_CATALOG_DATASHEETS);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedFaction, setSelectedFaction] = useState('adeptus_astartes');
  const [selectedUnitForModal, setSelectedUnitForModal] = useState<any | null>(null);

  const loadDatasheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDatasheets(selectedFaction);
      if (Array.isArray(data) && data.length > 0) {
        setDatasheets(data);
      } else {
        setDatasheets(FALLBACK_CATALOG_DATASHEETS);
      }
    } catch (err) {
      console.warn('[Catalog] Using fallback datasheet collection:', err);
      setDatasheets(FALLBACK_CATALOG_DATASHEETS);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFaction]);

  useEffect(() => {
    loadDatasheets();
  }, [loadDatasheets]);

  const filteredDatasheets = useMemo(() => {
    return datasheets.filter(ds => {
      const matchesSearch =
        searchQuery === '' ||
        ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(ds.keywords) && ds.keywords.some((k: string) => k.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesRole =
        selectedRole === 'ALL' || ds.battlefieldRole === selectedRole;

      return matchesSearch && matchesRole;
    });
  }, [datasheets, searchQuery, selectedRole]);

  return (
    <ThemeProvider themeKey={activeTheme}>
      {/* ── App Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: '1rem',
              transition: 'all 150ms ease',
            }}
          >
            ←
          </Link>
          <ChapterIcon chapterKey={activeTheme} size={30} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="app-title">ForceOrg-40k</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                DATASHEET CATALOG
              </span>
            </div>
            <div className="app-subtitle">
              Browse 11th Edition Datasheets, Stats & Composition
            </div>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Link
            href="/changelog"
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', textDecoration: 'none' }}
          >
            📡 Rules Changelog
          </Link>
          <Link
            href="/"
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', textDecoration: 'none' }}
          >
            ⚔️ My Armies
          </Link>
          <FactionSelector
            currentTheme={activeTheme}
            onThemeChange={setActiveTheme}
          />
        </div>
      </header>

      {/* ── Main Catalog Content ────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface-card, #0f141c)',
            border: '1px solid var(--surface-border, #1e293b)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search datasheets by name, keyword (e.g., Terminator, Fly, Epic Hero)…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--surface-border, #1e293b)',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />

            <button
              onClick={loadDatasheets}
              disabled={isLoading}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
            >
              {isLoading ? 'Loading…' : '↻ Refresh Data'}
            </button>
          </div>

          {/* Role Filter Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {Object.entries(ROLE_ICONS).map(([roleKey, meta]) => (
              <button
                key={roleKey}
                type="button"
                onClick={() => setSelectedRole(roleKey)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedRole === roleKey ? '1px solid var(--c-trim, #c89d3c)' : '1px solid var(--surface-border, #1e293b)',
                  background: selectedRole === roleKey ? 'rgba(200, 157, 60, 0.18)' : 'transparent',
                  color: selectedRole === roleKey ? 'var(--c-trim, #c89d3c)' : 'var(--text-muted, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 150ms ease',
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Datasheet Cards Grid ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {filteredDatasheets.map(ds => {
            const roleMeta = (ds.battlefieldRole && ROLE_ICONS[ds.battlefieldRole]) || DEFAULT_ROLE_META;
            const stats = ds.stats || {};

            return (
              <div
                key={ds.id}
                onClick={() => setSelectedUnitForModal(ds)}
                style={{
                  background: 'var(--surface-card, #0f141c)',
                  border: '1.5px solid var(--surface-border, #1e293b)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--c-trim, #c89d3c)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--surface-border, #1e293b)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'linear-gradient(135deg, rgba(11, 48, 86, 0.4) 0%, rgba(15, 20, 28, 0.9) 100%)',
                    borderBottom: '1px solid var(--surface-border, #1e293b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{roleMeta.icon}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                        {ds.name}
                      </h3>
                      <div style={{ fontSize: '0.7rem', color: roleMeta.color, fontWeight: 600 }}>
                        {ds.battlefieldRole.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--c-trim, #c89d3c)' }}>
                      {ds.basePoints} pts
                    </div>
                    {ds.detachmentPointsCost > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700 }}>
                        +{ds.detachmentPointsCost} DP
                      </span>
                    )}
                  </div>
                </div>

                {/* Stat Pips Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid var(--surface-border, #1e293b)',
                    padding: '0.4rem 0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>M</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.movement || '6"'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>T</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.toughness || 4}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>SV</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.save || '3+'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>W</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.wounds || 2}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>LD</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.leadership || '6+'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>OC</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{stats.objectiveControl || 1}</div>
                  </div>
                </div>

                {/* Keywords Preview */}
                <div style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {(ds.keywords || []).slice(0, 5).map((kw: string) => (
                      <span
                        key={kw}
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          background: '#1e293b',
                          borderRadius: '3px',
                          color: kw === 'CHARACTER' ? 'var(--c-trim)' : 'var(--text-muted)',
                          border: kw === 'CHARACTER' ? '1px solid var(--c-trim)' : '1px solid #334155',
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                    {(ds.keywords || []).length > 5 && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '1px 3px' }}>
                        +{ds.keywords.length - 5}
                      </span>
                    )}
                  </div>

                  {ds.wargearRulesRaw && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 'auto', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ds.wargearRulesRaw}
                    </div>
                  )}
                </div>

                {/* Card Action */}
                <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--surface-border, #1e293b)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--c-trim, #c89d3c)', fontWeight: 700 }}>
                    View Full Datasheet →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Datasheet Detail Modal ───────────────────────────────────────── */}
        {selectedUnitForModal && (
          <div
            className="modal-backdrop"
            onClick={e => {
              if (e.target === e.currentTarget) setSelectedUnitForModal(null);
            }}
          >
            <div className="modal-container" style={{ maxWidth: '600px', width: '92%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                    {selectedUnitForModal.name}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-trim, #c89d3c)', fontWeight: 700 }}>
                    {selectedUnitForModal.basePoints} pts · {selectedUnitForModal.battlefieldRole.replace(/_/g, ' ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setSelectedUnitForModal(null)}
                >
                  ✕
                </button>
              </div>

              {/* Composition */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Unit Composition
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  {(selectedUnitForModal.unitComposition?.models || []).map((m: any, i: number) => (
                    <div key={i}>
                      • {m.count}x {m.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Wargear Rules */}
              {selectedUnitForModal.wargearRulesRaw && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Wargear Options
                  </div>
                  <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                    {selectedUnitForModal.wargearRulesRaw}
                  </pre>
                </div>
              )}

              {/* Keywords */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Keywords
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(selectedUnitForModal.keywords || []).map((kw: string) => (
                    <span
                      key={kw}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        background: '#1e293b',
                        borderRadius: '3px',
                        border: '1px solid #334155',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <Link
                  href="/"
                  className="btn btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  Add to Army via Studio
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedUnitForModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ThemeProvider>
  );
}
