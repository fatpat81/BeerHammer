// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Tabletop Console (View Mode)
// Route: /army/[id]
// Step 2.5: Live roster + datasheets loading into CompositeUnitCard & Stratagems
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ThemeProvider, ChapterIcon, ALL_FACTION_PALETTES } from '@forceorg/ui-theme';
import { CompositeUnitCard } from '@/components/CompositeUnitCard';
import { StratagemPanel } from '@/components/StratagemPanel';
import { FactionSelector } from '@/components/FactionSelector';
import { ComplianceDashboard } from '@/components/ComplianceDashboard';
import { FullPageSkeleton } from '@/components/Skeleton';
import { fetchRoster, fetchDatasheets } from '@/lib/api';
import type { UserArmy, Datasheet } from '@forceorg/types';
import type { ModelHealth, WeaponProfile, UnitAbility } from '@/components/CompositeUnitCard';
import type { RosterUnit } from '@/components/RosterBuilder';

// Fallback demo units for offline or new armies
const DEMO_FALLBACK_UNITS: Array<{
  instanceId: string;
  name: string;
  role: string;
  points: number;
  keywords: string[];
  stats: {
    movement: string;
    bodyguardToughness: number;
    armorSave: string;
    invulnerableSave?: string;
    leadership: string;
    objectiveControl: number;
  };
  models: ModelHealth[];
  weapons: WeaponProfile[];
  abilities: UnitAbility[];
}> = [
  {
    instanceId: 'inst_term_captain',
    name: 'Captain in Terminator Armour',
    role: 'CHARACTER',
    points: 95,
    keywords: ['INFANTRY', 'CHARACTER', 'EPIC HERO', 'IMPERIUM', 'TERMINATOR', 'CAPTAIN'],
    stats: { movement: '5"', bodyguardToughness: 5, armorSave: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
    models: [{ id: 'm1', modelName: 'Captain in Terminator Armour', isLeader: true, maxWounds: 6, currentWounds: 6 }],
    weapons: [
      { id: 'w1', name: 'Storm Bolter', range: '24"', attacks: '2', skill: '2+', strength: 4, armorPenetration: 0, damage: '1', keywords: ['RAPID FIRE 2'] },
      { id: 'w2', name: 'Relic Weapon', range: 'Melee', attacks: '6', skill: '2+', strength: 5, armorPenetration: 2, damage: '2', keywords: ['LETHAL HITS'] },
    ],
    abilities: [
      { id: 'a1', name: 'Rites of Battle', source: 'Leader', description: 'Once per battle round, one unit from your army with this ability can target this unit with a Stratagem for 0CP.' },
      { id: 'a2', name: 'Finest Hour', source: 'Leader', description: 'Once per battle, in the Fight phase, the model attacks characteristics are increased by 3.' },
    ],
  },
  {
    instanceId: 'inst_term_squad',
    name: 'Terminator Squad',
    role: 'INFANTRY',
    points: 185,
    keywords: ['INFANTRY', 'IMPERIUM', 'TERMINATOR'],
    stats: { movement: '5"', bodyguardToughness: 5, armorSave: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
    models: [
      { id: 'tm1', modelName: 'Terminator Sergeant', isLeader: true, maxWounds: 3, currentWounds: 3 },
      { id: 'tm2', modelName: 'Terminator with Assault Cannon', isLeader: false, maxWounds: 3, currentWounds: 3 },
      { id: 'tm3', modelName: 'Terminator with Storm Bolter', isLeader: false, maxWounds: 3, currentWounds: 3 },
      { id: 'tm4', modelName: 'Terminator with Storm Bolter', isLeader: false, maxWounds: 3, currentWounds: 3 },
      { id: 'tm5', modelName: 'Terminator with Storm Bolter', isLeader: false, maxWounds: 3, currentWounds: 3 },
    ],
    weapons: [
      { id: 'w3', name: 'Assault Cannon', range: '24"', attacks: '6', skill: '3+', strength: 6, armorPenetration: 1, damage: '1', keywords: ['DEVASTATING WOUNDS'] },
      { id: 'w4', name: 'Power Fist', range: 'Melee', attacks: '3', skill: '3+', strength: 8, armorPenetration: 2, damage: '2', keywords: [] },
    ],
    abilities: [
      { id: 'a3', name: 'Fury of the First', source: 'Bodyguard', description: 'Each time a model in this unit makes an attack, add 1 to the Hit roll.' },
    ],
  },
  {
    instanceId: 'inst_intercessors',
    name: 'Intercessor Squad',
    role: 'BATTLELINE',
    points: 75,
    keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
    stats: { movement: '6"', bodyguardToughness: 4, armorSave: '3+', leadership: '6+', objectiveControl: 2 },
    models: [
      { id: 'int1', modelName: 'Intercessor Sergeant', isLeader: true, maxWounds: 2, currentWounds: 2 },
      { id: 'int2', modelName: 'Intercessor', isLeader: false, maxWounds: 2, currentWounds: 2 },
      { id: 'int3', modelName: 'Intercessor', isLeader: false, maxWounds: 2, currentWounds: 2 },
      { id: 'int4', modelName: 'Intercessor', isLeader: false, maxWounds: 2, currentWounds: 2 },
      { id: 'int5', modelName: 'Intercessor', isLeader: false, maxWounds: 2, currentWounds: 2 },
    ],
    weapons: [
      { id: 'w5', name: 'Bolt Rifle', range: '24"', attacks: '2', skill: '3+', strength: 4, armorPenetration: 1, damage: '1', keywords: ['ASSAULT', 'HEAVY'] },
      { id: 'w6', name: 'Close Combat Weapon', range: 'Melee', attacks: '3', skill: '3+', strength: 4, armorPenetration: 0, damage: '1', keywords: [] },
    ],
    abilities: [
      { id: 'a4', name: 'Objective Secured', source: 'Bodyguard', description: 'This unit has an Objective Control characteristic of 2 instead of 1.' },
    ],
  },
];

export default function TabletopConsolePage() {
  const params = useParams();
  const router = useRouter();
  const armyId = params.id as string;

  const [army, setArmy] = useState<UserArmy | null>(null);
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [showStratagems, setShowStratagems] = useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // ── Wake Lock for tournament play ─────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        setWakeLock(sentinel);
        sentinel.addEventListener('release', () => setWakeLock(null));
      }
    } catch {
      // Ignore if user denies or not supported
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
    }
  }, [wakeLock]);

  useEffect(() => {
    requestWakeLock();
    return () => {
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  // ── Fetch Roster and Datasheets ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const rosterData = await fetchRoster(armyId);
        if (mounted && rosterData) {
          setArmy(rosterData);
          if (rosterData.factionThemeOverride) {
            setActiveTheme(rosterData.factionThemeOverride);
          }
          const ds = await fetchDatasheets(rosterData.factionId);
          if (mounted && Array.isArray(ds)) {
            setDatasheets(ds);
          }
        }
      } catch (err) {
        console.warn('[TabletopConsole] Live fetch failed, using fallback:', err);
        // Fallback demo army
        if (mounted) {
          setArmy({
            id: armyId,
            userId: 'local-user',
            name: 'Ultramarines 1st Company',
            factionId: 'adeptus_astartes',
            rulesetVersionId: '11.1.0-2026-Q3',
            detachmentPrimary: 'Gladius Task Force',
            detachmentSecondary: null,
            pointsLimit: 2000,
            detachmentPointsLimit: 3,
            factionThemeOverride: 'ultramarines',
            rosterPayload: { units: [], totalPoints: 355, detachmentPointsUsed: 0 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [armyId]);

  // ── Compute Display Units ────────────────────────────────────────────────
  const unitsList = useMemo(() => {
    const payloadUnits: RosterUnit[] = (army?.rosterPayload as any)?.units || [];
    if (payloadUnits.length === 0) {
      return DEMO_FALLBACK_UNITS;
    }

// Roster units persisted by lib/api.ts in guest/offline mode carry only
// datasheetId/datasheetName/modelCount; RosterBuilder produces the richer
// catalogUnit shape. Both must render here.
type OfflineRosterUnit = {
  instanceId: string;
  datasheetId?: string;
  datasheetName?: string;
  modelCount?: number;
  wargearSelections?: unknown[];
  pointsCost: number;
  catalogUnit?: RosterUnit['catalogUnit'];
};

type NormalizedCatalogUnit = RosterUnit['catalogUnit'] & {
  modelComposition: { name: string; count: number }[];
};

    return payloadUnits.map((puRaw, i) => {
      const pu = puRaw as unknown as OfflineRosterUnit;
      // Roster units persisted in guest/offline mode (lib/api.ts) carry only
      // datasheetId/datasheetName on the unit; the richer catalogUnit shape is
      // produced by RosterBuilder. Normalize so both render without crashing.
      const catalogUnit: NormalizedCatalogUnit = pu.catalogUnit ?? {
        id: pu.datasheetId ?? `ds_${i}`,
        name: pu.datasheetName ?? 'Unknown Unit',
        factionId: army?.factionId ?? 'adeptus_astartes',
        battlefieldRole: 'INFANTRY',
        basePoints: pu.pointsCost ?? 0,
        dpCost: 0,
        keywords: [],
        wargearRulesRaw: '',
        modelComposition: [{ name: pu.datasheetName ?? 'Model', count: pu.modelCount ?? 1 }],
      };
      const ds = datasheets.find(d => d.id === catalogUnit.id || d.name === catalogUnit.name);
      const dsStats = ds?.stats as any;

      const models: ModelHealth[] = (catalogUnit.modelComposition || []).flatMap((mc, mIdx) =>
        Array.from({ length: mc.count }).map((_, cIdx) => ({
          id: `m_${pu.instanceId}_${mIdx}_${cIdx}`,
          modelName: mc.name,
          isLeader: mc.name.toLowerCase().includes('sergeant') || mc.name.toLowerCase().includes('captain') || mc.name.toLowerCase().includes('leader'),
          maxWounds: (dsStats?.wounds || dsStats?.toughness || 4) > 5 ? 3 : 2,
          currentWounds: (dsStats?.wounds || dsStats?.toughness || 4) > 5 ? 3 : 2,
        }))
      );

      return {
        instanceId: pu.instanceId,
        name: catalogUnit.name,
        role: catalogUnit.battlefieldRole,
        points: pu.pointsCost,
        keywords: catalogUnit.keywords || [],
        stats: {
          movement: dsStats?.movement || '6"',
          bodyguardToughness: dsStats?.toughness || 4,
          armorSave: dsStats?.save || '3+',
          invulnerableSave: dsStats?.invulnerableSave || undefined,
          leadership: dsStats?.leadership || '6+',
          objectiveControl: dsStats?.objectiveControl || 1,
        },
        models: models.length > 0 ? models : [{ id: `m_${i}`, modelName: catalogUnit.name, isLeader: true, maxWounds: 4, currentWounds: 4 }],
        weapons: (ds as any)?.weapons?.map((w: any) => ({
          id: w.weapon?.id || `w_${i}`,
          name: w.weapon?.name || 'Default Weapon',
          range: w.weapon?.range || '24"',
          attacks: w.weapon?.attacks || '2',
          skill: w.weapon?.skill || '3+',
          strength: w.weapon?.strength || 4,
          armorPenetration: w.weapon?.armorPenetration || 0,
          damage: w.weapon?.damage || '1',
          keywords: w.weapon?.keywords || [],
        })) || DEMO_FALLBACK_UNITS[0]!.weapons,
        abilities: (ds as any)?.abilities?.map((a: any) => ({
          id: a.id,
          name: a.name,
          source: a.source === 'LEADER' ? 'Leader' : 'Bodyguard',
          description: a.description,
        })) || DEMO_FALLBACK_UNITS[0]!.abilities,
      };
    });
  }, [army, datasheets]);

  const activeUnit = unitsList[activeUnitIndex] || unitsList[0];

  const totalPoints = useMemo(() => {
    return unitsList.reduce((sum, u) => sum + u.points, 0);
  }, [unitsList]);

  if (loading) {
    return <FullPageSkeleton />;
  }

  if (!activeUnit) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>No units in this force yet</h2>
        <Link href={`/army/${armyId}/edit`} style={{ color: 'var(--c-trim)', fontWeight: 700 }}>
          Go to Roster Studio to assemble units →
        </Link>
      </div>
    );
  }

  return (
    <ThemeProvider themeKey={activeTheme}>
      {/* ── Tabletop Header ────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/"
            title="Return to My Armies"
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
              <span className="app-title">{army?.name || 'Tabletop Console'}</span>
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}>
                CONSOLE
              </span>
            </div>
            <div className="app-subtitle">
              {army?.detachmentPrimary || 'Standard Detachment'} • {totalPoints} / {army?.pointsLimit || 2000} pts
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Mode Toggle Switcher */}
          <div className="mode-toggle">
            <Link
              href={`/army/${armyId}/edit`}
              className="mode-toggle-btn"
              style={{ textDecoration: 'none' }}
            >
              <span className="mode-toggle-icon">✎</span>
              <span className="mode-toggle-label">Edit</span>
            </Link>
            <div className="mode-toggle-btn mode-toggle-btn--active">
              <span className="mode-toggle-icon">⚔</span>
              <span className="mode-toggle-label">Console</span>
            </div>
          </div>

          {/* Rules Compliance Audit Button */}
          <button
            type="button"
            onClick={() => setIsComplianceOpen(true)}
            title="Check 11th Edition Rules & Points Compliance"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(200, 157, 60, 0.12)',
              border: '1px solid var(--c-trim, #c89d3c)',
              color: 'var(--c-trim, #c89d3c)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            <span>⚖️</span>
            <span>Rules Audit</span>
          </button>

          {/* Faction Palette Switcher */}
          <FactionSelector
            currentTheme={activeTheme}
            onThemeChange={setActiveTheme}
          />

          {/* Screen Wake Lock Indicator */}
          <button
            onClick={() => (wakeLock ? releaseWakeLock() : requestWakeLock())}
            title={wakeLock ? 'Screen lock active (keeps display on)' : 'Screen lock off (tap to enable)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: wakeLock ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface-card)',
              border: wakeLock ? '1px solid #22c55e' : '1px solid var(--surface-border)',
              color: wakeLock ? '#4ade80' : 'var(--text-muted)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: wakeLock ? '#22C55E' : '#64748B',
                boxShadow: wakeLock ? '0 0 6px rgba(34, 197, 94, 0.8)' : 'none',
              }}
            />
            <span>{wakeLock ? 'Screen Awake' : 'Awake'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <main className="app-main">
        {/* Triple-column desktop */}
        <div className="layout-desktop">
          {/* ── Left Panel: Roster Index ──────────────────────────────────── */}
          <aside className="panel panel--sidebar" style={{ alignSelf: 'start', position: 'sticky', top: '70px' }}>
            <div className="panel-header">Force Units ({unitsList.length})</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              {army?.detachmentPrimary}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {unitsList.map((unit, i) => (
                <div
                  key={unit.instanceId || i}
                  className="roster-unit-row"
                  data-active={activeUnitIndex === i || undefined}
                  onClick={() => setActiveUnitIndex(i)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: activeUnitIndex === i ? 'rgba(200, 157, 60, 0.12)' : 'rgba(15, 20, 28, 0.6)',
                    borderLeft: activeUnitIndex === i ? '3px solid var(--c-trim)' : '3px solid transparent',
                    border: '1px solid var(--surface-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: activeUnitIndex === i ? 700 : 500, color: 'var(--text-primary)' }}>
                      {unit.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {unit.role}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--c-trim)', fontWeight: 700 }}>
                    {unit.points}pts
                  </span>
                </div>
              ))}
            </div>

            {/* Points Summary Bar */}
            <div className="points-summary" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span>Total Points</span>
                <span style={{ color: 'var(--c-trim)', fontWeight: 700 }}>
                  {totalPoints} / {army?.pointsLimit || 2000}
                </span>
              </div>
              <div className="points-bar">
                <div
                  className="points-bar-fill"
                  style={{ width: `${Math.min(100, (totalPoints / (army?.pointsLimit || 2000)) * 100)}%` }}
                />
              </div>
            </div>
          </aside>

          {/* ── Center: Active Unit Card ──────────────────────────────────── */}
          <section>
            <CompositeUnitCard
              rosterId={armyId}
              unitInstanceId={activeUnit.instanceId}
              bodyguardName={activeUnit.name}
              chapterKey={activeTheme}
              stats={activeUnit.stats}
              keywords={activeUnit.keywords}
              initialModels={activeUnit.models}
              weapons={activeUnit.weapons}
              abilities={activeUnit.abilities}
              canonicalImageUrl="/assets/models/default_placeholder.webp"
              availableStratagemsCount={6}
              onOpenStratagems={() => setShowStratagems(true)}
            />
          </section>

          {/* ── Right Panel: Stratagem Directory ──────────────────────────── */}
          <aside className="panel panel--sidebar" style={{ alignSelf: 'start', position: 'sticky', top: '70px' }}>
            <StratagemPanel
              unitKeywords={activeUnit.keywords}
              detachmentId={army?.detachmentPrimary}
              isOpen={true}
            />
          </aside>
        </div>

        {/* Tablet & Mobile Stacked */}
        <div className="layout-mobile">
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {unitsList.map((unit, i) => (
              <button
                key={unit.instanceId || i}
                onClick={() => setActiveUnitIndex(i)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: activeUnitIndex === i ? '1px solid var(--c-trim)' : '1px solid var(--surface-border)',
                  background: activeUnitIndex === i ? 'rgba(200, 157, 60, 0.15)' : 'var(--surface-card)',
                  color: activeUnitIndex === i ? 'var(--c-trim)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {unit.name} ({unit.points}pts)
              </button>
            ))}
          </div>

          <CompositeUnitCard
            rosterId={armyId}
            unitInstanceId={activeUnit.instanceId}
            bodyguardName={activeUnit.name}
            chapterKey={activeTheme}
            stats={activeUnit.stats}
            keywords={activeUnit.keywords}
            initialModels={activeUnit.models}
            weapons={activeUnit.weapons}
            abilities={activeUnit.abilities}
            canonicalImageUrl="/assets/models/default_placeholder.webp"
            customImageUrl={
              (activeUnit as any).customImageUrl ||
              (army as any)?.unitMedia?.find((m: any) => m.unitInstanceId === activeUnit.instanceId)?.imageUrl ||
              null
            }
            availableStratagemsCount={6}
            onOpenStratagems={() => setShowStratagems(true)}
            onCustomPhotoChange={newUrl => {
              setArmy(prev => {
                if (!prev) return prev;
                const existingMedia = (prev as any).unitMedia || [];
                const updatedMedia = existingMedia.filter((m: any) => m.unitInstanceId !== activeUnit.instanceId);
                if (newUrl) {
                  updatedMedia.push({
                    id: `media-${Date.now()}`,
                    userId: prev.userId,
                    rosterId: prev.id,
                    unitInstanceId: activeUnit.instanceId,
                    imageUrl: newUrl,
                    thumbnailUrl: newUrl,
                    storageKeyPrefix: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
                return { ...prev, unitMedia: updatedMedia };
              });
            }}
          />
        </div>
      </main>

      {/* ── Mobile Stratagem Overlay ────────────────────────────────────────── */}
      {showStratagems && (
        <div className="stratagem-overlay" onClick={() => setShowStratagems(false)}>
          <div
            className="panel stratagem-overlay-content"
            onClick={e => e.stopPropagation()}
          >
            <StratagemPanel
              unitKeywords={activeUnit.keywords}
              detachmentId={army?.detachmentPrimary}
              isOpen={true}
            />
            <button
              onClick={() => setShowStratagems(false)}
              className="btn-close-strats"
            >
              Close Stratagems
            </button>
          </div>
        </div>
      )}

      {/* ── Rules Compliance Dashboard Modal ──────────────────────────────── */}
      <ComplianceDashboard
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        rosterId={armyId}
        armyName={army?.name || 'Tabletop Army'}
        pointsLimit={army?.pointsLimit || 2000}
        currentPoints={totalPoints}
      />
    </ThemeProvider>
  );
}
