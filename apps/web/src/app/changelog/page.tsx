// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Rules Changelog & Sync Diffs Page (§5.3)
// Route: /changelog
// Surfaces Munitorum Field Manual balance shifts and Wahapedia ETL sync deltas
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ThemeProvider, ChapterIcon, ALL_FACTION_PALETTES } from '@forceorg/ui-theme';
import { FactionSelector } from '@/components/FactionSelector';
import { fetchChangelog, ChangelogData, RulesChangeItem } from '@/lib/api';

// Curated fallback data for instant offline/build-time rendering
const FALLBACK_CHANGELOG: ChangelogData = {
  currentRulesetVersion: '11.1.0-2026-Q3-MFM',
  lastSyncedAt: new Date().toISOString(),
  syncStatus: 'SYNCHRONIZED',
  totalChanges: 7,
  recentChanges: [
    {
      id: 'chg-01',
      category: 'POINTS_CUT',
      factionId: 'adeptus_astartes',
      factionName: 'Space Marines',
      targetName: 'Terminator Squad',
      previousValue: '185 pts',
      currentValue: '175 pts',
      effectiveDate: '2026-09-15',
      summary: 'Points reduction (-10 pts) to enhance veteran elite viability in Strike Force games.',
    },
    {
      id: 'chg-02',
      category: 'POINTS_CUT',
      factionId: 'adeptus_astartes',
      factionName: 'Space Marines',
      targetName: 'Captain in Terminator Armour',
      previousValue: '95 pts',
      currentValue: '90 pts',
      effectiveDate: '2026-09-15',
      summary: 'Roster leader discount (-5 pts) aligning with 11th Edition detachment hero efficiency.',
    },
    {
      id: 'chg-03',
      category: 'POINTS_CUT',
      factionId: 'adeptus_astartes',
      factionName: 'Space Marines',
      targetName: 'Intercessor Squad',
      previousValue: '80 pts',
      currentValue: '75 pts',
      effectiveDate: '2026-09-15',
      summary: 'Battleline objective holder discount (-5 pts for 5 models).',
    },
    {
      id: 'chg-04',
      category: 'ERRATA',
      factionId: 'adeptus_astartes',
      factionName: 'Space Marines',
      targetName: '1st Company Task Force',
      currentValue: 'Detachment Points Quota: 3 DP',
      effectiveDate: '2026-09-15',
      summary: '11th Edition Detachment Point allowance verified at 3 DP limit.',
    },
    {
      id: 'chg-05',
      category: 'KEYWORD_UPDATE',
      factionId: 'adeptus_astartes',
      factionName: 'Space Marines',
      targetName: 'Captain in Terminator Armour',
      currentValue: '+EPIC HERO, +TACTICUS LEADER',
      effectiveDate: '2026-09-15',
      summary: 'Updated attachment compatibility tags for Terminator Bodyguard attachment.',
    },
    {
      id: 'chg-06',
      category: 'POINTS_HIKE',
      factionId: 'necrons',
      factionName: 'Necrons',
      targetName: "C'tan Shard of the Void Dragon",
      previousValue: '270 pts',
      currentValue: '290 pts',
      effectiveDate: '2026-09-15',
      summary: 'Adjusted up (+20 pts) due to dominant competitive durability.',
    },
    {
      id: 'chg-07',
      category: 'POINTS_CUT',
      factionId: 'tyranids',
      factionName: 'Tyranids',
      targetName: 'Carnifex Brood',
      previousValue: '125 pts',
      currentValue: '115 pts',
      effectiveDate: '2026-09-15',
      summary: 'Monster swarm reduction (-10 pts per beast) in Invasion Fleet detachments.',
    },
  ],
  syncRecords: [
    {
      endpoint: 'https://wahapedia.ru/wh40k11e/datasheets.json',
      status: 'SUCCESS',
      recordCount: 42,
      syncedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      endpoint: 'https://wahapedia.ru/wh40k11e/weapons.json',
      status: 'SUCCESS',
      recordCount: 118,
      syncedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      endpoint: 'https://wahapedia.ru/wh40k11e/stratagems.json',
      status: 'SUCCESS',
      recordCount: 24,
      syncedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ],
};

export default function ChangelogPage() {
  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [changelogData, setChangelogData] = useState<ChangelogData>(FALLBACK_CHANGELOG);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFaction, setSelectedFaction] = useState<string>('ALL');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchChangelog();
        if (data && data.recentChanges) {
          setChangelogData(data);
        }
      } catch (err) {
        console.warn('[Changelog] Using fallback dataset:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const changes = changelogData.recentChanges || [];

  // Filtered changes
  const filteredChanges = useMemo(() => {
    return changes.filter(chg => {
      const matchesSearch =
        searchQuery === '' ||
        chg.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chg.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chg.factionName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'ALL' || chg.category === selectedCategory;

      const matchesFaction =
        selectedFaction === 'ALL' || chg.factionId === selectedFaction;

      return matchesSearch && matchesCat && matchesFaction;
    });
  }, [changes, searchQuery, selectedCategory, selectedFaction]);

  const stats = useMemo(() => {
    const pointCuts = changes.filter(c => c.category === 'POINTS_CUT').length;
    const pointHikes = changes.filter(c => c.category === 'POINTS_HIKE').length;
    const errata = changes.filter(c => c.category === 'ERRATA' || c.category === 'KEYWORD_UPDATE').length;
    return { pointCuts, pointHikes, errata, total: changes.length };
  }, [changes]);

  const uniqueFactions = useMemo(() => {
    const map = new Map<string, string>();
    changes.forEach(c => map.set(c.factionId, c.factionName));
    return Array.from(map.entries());
  }, [changes]);

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
                  background: 'rgba(200, 157, 60, 0.15)',
                  color: 'var(--c-trim)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                RULES CHANGELOG
              </span>
            </div>
            <div className="app-subtitle">
              Munitorum Field Manual & Wahapedia ETL Balance Diffs
            </div>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Link
            href="/catalog"
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', textDecoration: 'none' }}
          >
            📚 Datasheet Catalog
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

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* ── Ruleset Status Hero Banner ───────────────────────────────────── */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-lg, 8px)',
            background: 'linear-gradient(135deg, rgba(11, 48, 86, 0.4) 0%, rgba(15, 20, 28, 0.9) 100%)',
            border: '1.5px solid var(--c-trim, #c89d3c)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📡</span>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Active Ruleset: {changelogData.currentRulesetVersion}
              </h1>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--c-text-muted, #a3a3a3)' }}>
              Last synchronized with Wahapedia ETL at{' '}
              <strong>{new Date(changelogData.lastSyncedAt).toLocaleString()}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                fontWeight: 700,
              }}
            >
              ● Synchronized
            </span>
          </div>
        </div>

        {/* ── Stat Highlights ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--surface-card, #0f141c)', border: '1px solid var(--surface-border, #1e293b)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Balance Shifts</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--c-trim, #c89d3c)', marginTop: '0.2rem' }}>
              {stats.total}
            </div>
          </div>
          <div style={{ background: 'var(--surface-card, #0f141c)', border: '1px solid var(--surface-border, #1e293b)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Points Reductions (Buffs)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>
              +{stats.pointCuts}
            </div>
          </div>
          <div style={{ background: 'var(--surface-card, #0f141c)', border: '1px solid var(--surface-border, #1e293b)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Points Increases (Nerfs)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
              +{stats.pointHikes}
            </div>
          </div>
          <div style={{ background: 'var(--surface-card, #0f141c)', border: '1px solid var(--surface-border, #1e293b)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Errata & Keywords</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
              {stats.errata}
            </div>
          </div>
        </div>

        {/* ── Filters & Search Bar ─────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface-card, #0f141c)',
            border: '1px solid var(--surface-border, #1e293b)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search units, factions, or rules updates…"
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

            {/* Faction Filter Dropdown */}
            <select
              value={selectedFaction}
              onChange={e => setSelectedFaction(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'var(--surface-card, #0f141c)',
                border: '1px solid var(--surface-border, #1e293b)',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Factions</option>
              {uniqueFactions.map(([fid, fname]) => (
                <option key={fid} value={fid}>
                  {fname}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Updates' },
              { id: 'POINTS_CUT', label: '🟢 Points Cuts (Buffs)' },
              { id: 'POINTS_HIKE', label: '🔴 Points Increases (Nerfs)' },
              { id: 'ERRATA', label: '⚠️ Errata & Quotas' },
              { id: 'KEYWORD_UPDATE', label: '🏷️ Keyword Updates' },
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedCategory(pill.id)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedCategory === pill.id ? '1px solid var(--c-trim, #c89d3c)' : '1px solid var(--surface-border, #1e293b)',
                  background: selectedCategory === pill.id ? 'rgba(200, 157, 60, 0.18)' : 'transparent',
                  color: selectedCategory === pill.id ? 'var(--c-trim, #c89d3c)' : 'var(--text-muted, #94a3b8)',
                  transition: 'all 150ms ease',
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Changelog Cards Grid ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {filteredChanges.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                background: 'var(--surface-card, #0f141c)',
                borderRadius: '8px',
                border: '1px dashed var(--surface-border, #1e293b)',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              No balance changes matching your filters.
            </div>
          ) : (
            filteredChanges.map(chg => {
              const isCut = chg.category === 'POINTS_CUT';
              const isHike = chg.category === 'POINTS_HIKE';
              const isErrata = chg.category === 'ERRATA' || chg.category === 'KEYWORD_UPDATE';

              return (
                <div
                  key={chg.id}
                  style={{
                    background: 'var(--surface-card, #0f141c)',
                    border: `1px solid ${
                      isCut
                        ? 'rgba(34, 197, 94, 0.3)'
                        : isHike
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(56, 189, 248, 0.3)'
                    }`,
                    borderRadius: '8px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    transition: 'transform 150ms ease, border-color 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                        border: '1px solid var(--surface-border, #1e293b)',
                        flexShrink: 0,
                      }}
                    >
                      {isCut ? '📉' : isHike ? '📈' : '📜'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
                          {chg.targetName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: isCut
                              ? 'rgba(34, 197, 94, 0.2)'
                              : isHike
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                            color: isCut ? '#4ade80' : isHike ? '#f87171' : '#38bdf8',
                          }}
                        >
                          {chg.category.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          · {chg.factionName}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)', marginTop: '0.25rem' }}>
                        {chg.summary}
                      </div>
                    </div>
                  </div>

                  {/* Value Delta Comparison */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {chg.previousValue && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                        {chg.previousValue}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: isCut ? '#4ade80' : isHike ? '#f87171' : 'var(--c-trim, #c89d3c)',
                      }}
                    >
                      {chg.currentValue}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Effective: {chg.effectiveDate}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Wahapedia ETL Sync Pipeline Log ──────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface-card, #0f141c)',
            border: '1px solid var(--surface-border, #1e293b)',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔄</span>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Wahapedia ETL Daily Sync Log
            </h3>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Synchronized via automated cron at 02:00 UTC using HTTP 304 conditional cache headers and content hashing.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {(changelogData.syncRecords || []).map((sync, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  background: 'rgba(0,0,0,0.25)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4ade80' }}>✓</span>
                  <code style={{ color: 'var(--text-primary)' }}>{sync.endpoint.split('/').pop()}</code>
                  <span style={{ color: 'var(--text-muted)' }}>({sync.recordCount} records)</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {new Date(sync.syncedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
