// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Edit Mode Roster Builder (§7)
// Desktop-optimized force construction with wargear AST validation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { compileWahapediaWargear } from '@forceorg/rules-engine-11e';
import { fetchDatasheets } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { InlineError } from '@/components/ErrorBoundary';
import type { WargearRuleAST, BattlefieldRole, ConsumedSlot, Datasheet } from '@forceorg/types';

// ── Local Types ──────────────────────────────────────────────────────────────

export interface CatalogUnit {
  id: string;
  name: string;
  factionId: string;
  battlefieldRole: BattlefieldRole;
  basePoints: number;
  dpCost: number;
  keywords: string[];
  wargearRulesRaw: string;
  modelComposition: { name: string; count: number }[];
}

export interface RosterUnit {
  instanceId: string;
  catalogUnit: CatalogUnit;
  modelCount: number;
  wargearSelections: { ruleId: string; optionId: string; count: number }[];
  pointsCost: number;
  validationErrors: string[];
}

// ── Demo Catalog ─────────────────────────────────────────────────────────────

const DEMO_CATALOG: CatalogUnit[] = [
  {
    id: 'ds-captain-terminator',
    name: 'Captain in Terminator Armour',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'CHARACTER',
    basePoints: 95,
    dpCost: 0,
    keywords: ['INFANTRY', 'CHARACTER', 'EPIC HERO', 'IMPERIUM', 'TERMINATOR', 'CAPTAIN'],
    wargearRulesRaw: "The Captain's storm bolter can be replaced with 1 Combi-weapon or 1 Plasma Pistol\nThe Captain's power weapon can be replaced with 1 Power Fist, 1 Thunder Hammer, or 1 Chainfist",
    modelComposition: [{ name: 'Captain in Terminator Armour', count: 1 }],
  },
  {
    id: 'ds-terminator-squad',
    name: 'Terminator Squad',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'INFANTRY',
    basePoints: 185,
    dpCost: 0,
    keywords: ['INFANTRY', 'IMPERIUM', 'TERMINATOR'],
    wargearRulesRaw: "The Sergeant's storm bolter can be replaced with 1 Combi-weapon\nFor every 5 models in this unit, 1 model can replace its storm bolter and power fist with 1 Assault Cannon and 1 Power Fist or 1 Heavy Flamer and 1 Chainfist",
    modelComposition: [{ name: 'Terminator Sergeant', count: 1 }, { name: 'Terminator', count: 4 }],
  },
  {
    id: 'ds-intercessor-squad',
    name: 'Intercessor Squad',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'BATTLELINE',
    basePoints: 75,
    dpCost: 0,
    keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
    wargearRulesRaw: "The Sergeant's bolt rifle can be replaced with 1 Astartes Chainsword or 1 Power Weapon\nAny model can be equipped with 1 Astartes Grenade Launcher",
    modelComposition: [{ name: 'Intercessor Sergeant', count: 1 }, { name: 'Intercessor', count: 4 }],
  },
  {
    id: 'ds-redemptor-dreadnought',
    name: 'Redemptor Dreadnought',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'VEHICLE',
    basePoints: 210,
    dpCost: 0,
    keywords: ['VEHICLE', 'WALKER', 'IMPERIUM', 'DREADNOUGHT'],
    wargearRulesRaw: "The chassis's macro plasma incinerator can be replaced with 1 Heavy Onslaught Gatling Cannon\nThe chassis's onslaught gatling cannon can be replaced with 1 Icarus Rocket Pod",
    modelComposition: [{ name: 'Redemptor Dreadnought', count: 1 }],
  },
  {
    id: 'ds-assault-intercessors',
    name: 'Assault Intercessor Squad',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'BATTLELINE',
    basePoints: 75,
    dpCost: 0,
    keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
    wargearRulesRaw: "The Sergeant's Astartes chainsword can be replaced with 1 Power Weapon or 1 Thunder Hammer\nThe Sergeant's heavy bolt pistol can be replaced with 1 Hand Flamer or 1 Plasma Pistol",
    modelComposition: [{ name: 'Assault Intercessor Sergeant', count: 1 }, { name: 'Assault Intercessor', count: 4 }],
  },
  {
    id: 'ds-eradicator-squad',
    name: 'Eradicator Squad',
    factionId: 'adeptus_astartes',
    battlefieldRole: 'INFANTRY',
    basePoints: 95,
    dpCost: 0,
    keywords: ['INFANTRY', 'IMPERIUM', 'GRAVIS'],
    wargearRulesRaw: "Any model can be equipped with 1 Multi-melta instead of 1 Melta Rifle",
    modelComposition: [{ name: 'Eradicator Sergeant', count: 1 }, { name: 'Eradicator', count: 2 }],
  },
];

// ── Role Icons & Colors ──────────────────────────────────────────────────────

const ROLE_META: Record<string, { icon: string; color: string }> = {
  CHARACTER: { icon: '⚔', color: '#C89D3C' },
  BATTLELINE: { icon: '🛡', color: '#38BDF8' },
  INFANTRY: { icon: '🎯', color: '#22C55E' },
  VEHICLE: { icon: '🔧', color: '#F97316' },
  MOUNTED: { icon: '🐴', color: '#A855F7' },
  MONSTER: { icon: '🐉', color: '#EF4444' },
  DEDICATED_TRANSPORT: { icon: '🚛', color: '#64748B' },
  FORTIFICATION: { icon: '🏰', color: '#94A3B8' },
  ALLIED_UNIT: { icon: '🤝', color: '#06B6D4' },
};

// ── Component ────────────────────────────────────────────────────────────────

export interface RosterBuilderProps {
  factionId?: string;
  pointsLimit?: number;
  dpLimit?: number;
  initialUnits?: RosterUnit[];
  onRosterChange?: (units: RosterUnit[]) => void;
}

export const RosterBuilder: React.FC<RosterBuilderProps> = ({
  factionId = 'adeptus_astartes',
  pointsLimit = 2000,
  dpLimit = 3,
  initialUnits,
  onRosterChange,
}) => {
  const [rosterUnits, setRosterUnits] = useState<RosterUnit[]>(initialUnits || []);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogRoleFilter, setCatalogRoleFilter] = useState<string>('ALL');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  useEffect(() => {
    if (initialUnits) {
      setRosterUnits(initialUnits);
    }
  }, [initialUnits]);

  // Live catalog data state
  const [catalog, setCatalog] = useState<CatalogUnit[]>(DEMO_CATALOG);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogSource, setCatalogSource] = useState<'api' | 'demo'>('demo');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);
    try {
      const datasheets = await fetchDatasheets(factionId);
      if (Array.isArray(datasheets) && datasheets.length > 0) {
        const mappedUnits: CatalogUnit[] = datasheets.map(ds => {
          const wRules = (ds as any).wargearRules;
          const rawRules = Array.isArray(wRules)
            ? wRules.map((r: any) => r.rawText).filter(Boolean).join('\n')
            : '';

          const comp = (ds.unitComposition as any)?.models || [];
          const modelComposition = comp.map((m: any) => ({
            name: m.name || ds.name,
            count: m.count ?? m.min ?? 1,
          }));

          const fallbackDemo = DEMO_CATALOG.find(d => d.name.toLowerCase() === ds.name.toLowerCase());

          return {
            id: ds.id,
            name: ds.name,
            factionId: ds.factionId,
            battlefieldRole: ds.battlefieldRole,
            basePoints: ds.basePoints,
            dpCost: ds.detachmentPointsCost || 0,
            keywords: ds.keywords || [],
            wargearRulesRaw: rawRules || fallbackDemo?.wargearRulesRaw || '',
            modelComposition: modelComposition.length > 0 ? modelComposition : [{ name: ds.name, count: 1 }],
          };
        });
        setCatalog(mappedUnits);
        setCatalogSource('api');
      } else {
        const filteredDemo = DEMO_CATALOG.filter(u => u.factionId === factionId);
        setCatalog(filteredDemo.length > 0 ? filteredDemo : DEMO_CATALOG);
        setCatalogSource('demo');
      }
    } catch (err: any) {
      console.warn('[RosterBuilder] Live API catalog unavailable, using demo catalog:', err?.message);
      const filteredDemo = DEMO_CATALOG.filter(u => u.factionId === factionId);
      setCatalog(filteredDemo.length > 0 ? filteredDemo : DEMO_CATALOG);
      setCatalogSource('demo');
      setCatalogError(err?.message || 'Could not connect to live API');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [factionId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter(u => {
      if (catalogSource === 'api' && u.factionId !== factionId) return false;
      if (catalogRoleFilter !== 'ALL' && u.battlefieldRole !== catalogRoleFilter) return false;
      if (catalogSearch && !u.name.toLowerCase().includes(catalogSearch.toLowerCase())) return false;
      return true;
    });
  }, [catalog, factionId, catalogRoleFilter, catalogSearch, catalogSource]);

  // Roster stats
  const totalPoints = useMemo(() => rosterUnits.reduce((sum, u) => sum + u.pointsCost, 0), [rosterUnits]);
  const totalDP = useMemo(() => rosterUnits.reduce((sum, u) => sum + u.catalogUnit.dpCost, 0), [rosterUnits]);
  const unitCount = rosterUnits.length;

  // Rule of Three check
  const ruleOfThreeViolations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of rosterUnits) {
      counts.set(u.catalogUnit.id, (counts.get(u.catalogUnit.id) || 0) + 1);
    }
    const violations: string[] = [];
    for (const [id, count] of counts) {
      if (count > 3) {
        const unit = catalog.find(c => c.id === id) || DEMO_CATALOG.find(c => c.id === id);
        if (unit && unit.battlefieldRole !== 'BATTLELINE' && unit.battlefieldRole !== 'DEDICATED_TRANSPORT') {
          violations.push(`${unit.name} (${count}x — max 3)`);
        }
      }
    }
    return violations;
  }, [rosterUnits, catalog]);

  // Add unit to roster
  const addUnit = useCallback((catalogUnit: CatalogUnit) => {
    const newUnit: RosterUnit = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      catalogUnit,
      modelCount: catalogUnit.modelComposition.reduce((sum, m) => sum + m.count, 0),
      wargearSelections: [],
      pointsCost: catalogUnit.basePoints,
      validationErrors: [],
    };
    setRosterUnits(prev => {
      const next = [...prev, newUnit];
      onRosterChange?.(next);
      return next;
    });
  }, [onRosterChange]);

  // Remove unit from roster
  const removeUnit = useCallback((instanceId: string) => {
    setRosterUnits(prev => {
      const next = prev.filter(u => u.instanceId !== instanceId);
      onRosterChange?.(next);
      return next;
    });
    if (expandedUnit === instanceId) setExpandedUnit(null);
  }, [onRosterChange, expandedUnit]);

  // Compile wargear AST for expanded unit
  const wargearAST = useMemo(() => {
    if (!expandedUnit) return [];
    const unit = rosterUnits.find(u => u.instanceId === expandedUnit);
    if (!unit) return [];
    return compileWahapediaWargear(unit.catalogUnit.wargearRulesRaw);
  }, [expandedUnit, rosterUnits]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Roster Summary Bar ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        background: 'rgba(15, 20, 28, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
        borderRadius: 'var(--radius-lg, 8px)',
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Points</div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: totalPoints > pointsLimit ? '#EF4444' : 'var(--c-trim, #C89D3C)',
            }}>
              {totalPoints} / {pointsLimit}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DP</div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: totalDP > dpLimit ? '#EF4444' : 'var(--c-glow, #38BDF8)',
            }}>
              {totalDP} / {dpLimit}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Units</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{unitCount}</div>
          </div>
        </div>

        {/* Points Progress Bar */}
        <div style={{ flex: 1, maxWidth: 200, marginLeft: '1rem' }}>
          <div style={{ width: '100%', height: 4, background: 'var(--surface-border)', borderRadius: 2 }}>
            <div style={{
              width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%`,
              height: '100%',
              background: totalPoints > pointsLimit
                ? '#EF4444'
                : totalPoints > pointsLimit * 0.9
                  ? '#F59E0B'
                  : 'var(--c-glow)',
              borderRadius: 2,
              transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>
        </div>

        <button
          onClick={() => setShowCatalog(!showCatalog)}
          style={{
            padding: '0.5rem 1rem',
            background: showCatalog ? 'rgba(200, 157, 60, 0.2)' : 'var(--c-primary, #0b3056)',
            border: '1px solid var(--c-trim, #C89D3C)',
            borderRadius: 'var(--radius-md, 6px)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.8rem',
            transition: 'all 150ms ease',
          }}
        >
          {showCatalog ? '✕ Close Catalog' : '+ Add Unit'}
        </button>
      </div>

      {/* ── Validation Warnings ───────────────────────────────────────────── */}
      {(totalPoints > pointsLimit || totalDP > dpLimit || ruleOfThreeViolations.length > 0) && (
        <div style={{
          padding: '0.625rem 0.75rem',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md, 6px)',
          fontSize: '0.8rem',
          color: '#F87171',
        }}>
          <strong>⚠ Validation Errors:</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {totalPoints > pointsLimit && <li>Points exceeded by {totalPoints - pointsLimit}pts</li>}
            {totalDP > dpLimit && <li>DP budget exceeded by {totalDP - dpLimit}</li>}
            {ruleOfThreeViolations.map(v => <li key={v}>Rule of Three: {v}</li>)}
          </ul>
        </div>
      )}

      {/* ── Catalog Drawer ────────────────────────────────────────────────── */}
      {showCatalog && (
        <div style={{
          padding: '1rem',
          background: 'rgba(15, 20, 28, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--c-trim, rgba(200, 157, 60, 0.2))',
          borderRadius: 'var(--radius-lg, 8px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-trim)' }}>
              Unit Catalog — {factionId.replace(/_/g, ' ')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.65rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm, 4px)',
                fontWeight: 600,
                background: catalogSource === 'api' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: catalogSource === 'api' ? '#4ADE80' : '#FBBF24',
                border: catalogSource === 'api' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                {catalogSource === 'api' ? '● Live API Data' : '○ Standby Catalog'}
              </span>
              <button
                onClick={loadCatalog}
                disabled={isLoadingCatalog}
                title="Refresh catalog from API"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--surface-border)',
                  color: 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '3px 8px',
                  fontSize: '0.65rem',
                  cursor: isLoadingCatalog ? 'wait' : 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {isLoadingCatalog ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {/* Catalog Error Notice */}
          {catalogError && catalogSource === 'demo' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <InlineError
                message={`Notice: ${catalogError}. Showing local reference datasheets.`}
                onRetry={loadCatalog}
              />
            </div>
          )}

          {/* Search & Role Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search units…"
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 180,
                padding: '0.375rem 0.625rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            {['ALL', 'CHARACTER', 'BATTLELINE', 'INFANTRY', 'VEHICLE'].map(role => (
              <button
                key={role}
                onClick={() => setCatalogRoleFilter(role)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  border: catalogRoleFilter === role
                    ? '1px solid var(--c-glow, #38bdf8)'
                    : '1px solid var(--surface-border, #334155)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: catalogRoleFilter === role ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: catalogRoleFilter === role ? 'var(--c-glow)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 100ms ease',
                }}
              >
                {role === 'ALL' ? '⚡ All' : `${ROLE_META[role]?.icon || ''} ${role.charAt(0) + role.slice(1).toLowerCase()}`}
              </button>
            ))}
          </div>

          {/* Loading Skeletons */}
          {isLoadingCatalog ? (
            <div style={{ display: 'grid', gap: '0.375rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: '0.75rem', background: 'rgba(15, 20, 28, 0.7)', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--surface-border)' }}>
                  <Skeleton width="65%" height="0.9rem" />
                  <Skeleton width="40%" height="0.65rem" style={{ marginTop: '0.4rem' } as any} />
                </div>
              ))}
            </div>
          ) : (
            /* Catalog Grid */
            <div style={{ display: 'grid', gap: '0.375rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filteredCatalog.map(unit => {
              const role = ROLE_META[unit.battlefieldRole];
              return (
                <button
                  key={unit.id}
                  onClick={() => addUnit(unit)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(15, 20, 28, 0.7)',
                    border: '1px solid var(--surface-border, #334155)',
                    borderRadius: 'var(--radius-md, 6px)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 150ms ease',
                    width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ marginRight: '0.375rem' }}>{role?.icon}</span>
                      {unit.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: role?.color || 'var(--text-muted)' }}>
                      {unit.battlefieldRole.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--c-trim, #C89D3C)',
                    whiteSpace: 'nowrap',
                  }}>
                    {unit.basePoints}pts
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ── Roster Unit List ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {rosterUnits.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            border: '1px dashed var(--surface-border)',
            borderRadius: 'var(--radius-lg, 8px)',
          }}>
            No units added. Click <strong>&quot;+ Add Unit&quot;</strong> to begin building your roster.
          </div>
        ) : (
          rosterUnits.map(unit => {
            const role = ROLE_META[unit.catalogUnit.battlefieldRole];
            const isExpanded = expandedUnit === unit.instanceId;

            return (
              <div key={unit.instanceId} style={{
                background: 'rgba(15, 20, 28, 0.85)',
                border: isExpanded ? '1px solid var(--c-trim, rgba(200, 157, 60, 0.4))' : '1px solid rgba(148, 163, 184, 0.08)',
                borderRadius: 'var(--radius-md, 6px)',
                overflow: 'hidden',
                transition: 'border-color 150ms ease',
              }}>
                {/* Unit Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedUnit(isExpanded ? null : unit.instanceId)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{ fontSize: '1rem' }}>{role?.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{unit.catalogUnit.name}</div>
                      <div style={{ fontSize: '0.65rem', color: role?.color || 'var(--text-muted)' }}>
                        {unit.catalogUnit.battlefieldRole.replace(/_/g, ' ')} · {unit.modelCount} models
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-trim, #C89D3C)' }}>
                      {unit.pointsCost}pts
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeUnit(unit.instanceId); }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: '#F87171',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 150ms ease',
                      }}
                      title="Remove unit"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Expanded: Wargear Options */}
                {isExpanded && (
                  <div style={{
                    padding: '0.75rem',
                    borderTop: '1px solid var(--surface-border, #1e293b)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    animation: 'fadeIn 0.15s ease',
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                      Wargear Configuration
                    </div>

                    {wargearAST.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No configurable wargear options for this unit.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {wargearAST.map((rule, idx) => (
                          <WargearRuleCard key={rule.id + '-' + idx} rule={rule} />
                        ))}
                      </div>
                    )}

                    {/* Keywords */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {unit.catalogUnit.keywords.map(kw => (
                        <span key={kw} style={{
                          fontSize: '0.6rem',
                          padding: '2px 5px',
                          background: '#1e293b',
                          borderRadius: 3,
                          border: kw === 'CHARACTER' ? '1px solid var(--c-trim, #c89d3c)' : '1px solid #334155',
                          color: kw === 'CHARACTER' ? 'var(--c-trim, #c89d3c)' : 'var(--text-muted)',
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Wargear Rule Card ────────────────────────────────────────────────────────

const WargearRuleCard: React.FC<{ rule: WargearRuleAST }> = ({ rule }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const ruleTypeBadge = {
    REPLACE: { label: 'Replace', bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
    ADD_ON: { label: 'Add-On', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' },
    SQUAD_SYNC: { label: 'Sync', bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' },
    PAIR_LINK: { label: 'Pair', bg: 'rgba(168, 85, 247, 0.15)', color: '#A855F7' },
  }[rule.ruleType] || { label: rule.ruleType, bg: '#1e293b', color: '#94a3b8' };

  return (
    <div style={{
      padding: '0.5rem 0.625rem',
      background: 'rgba(15, 20, 28, 0.5)',
      borderLeft: `3px solid ${ruleTypeBadge.color}`,
      borderRadius: '0 4px 4px 0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <span style={{ fontSize: '0.6rem', padding: '1px 4px', background: ruleTypeBadge.bg, color: ruleTypeBadge.color, borderRadius: 3, marginRight: 6, fontWeight: 700 }}>
            {ruleTypeBadge.label}
          </span>
          {rule.scope.targetRole !== 'ANY' && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Target: {rule.scope.rawRoleName || rule.scope.targetRole}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
          Max: {typeof rule.constraint.maxSelections === 'number' ? rule.constraint.maxSelections : '∞'}
        </span>
      </div>

      {rule.replaces && (
        <div style={{ fontSize: '0.7rem', color: '#F87171', marginBottom: '0.25rem' }}>
          Replaces: {rule.replaces.count}× {rule.replaces.name}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {rule.options.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSelectedOption(selectedOption === opt.id ? null : opt.id)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: selectedOption === opt.id ? 700 : 500,
              border: selectedOption === opt.id
                ? '1px solid var(--c-glow, #38bdf8)'
                : '1px solid var(--surface-border, #334155)',
              borderRadius: 'var(--radius-sm, 4px)',
              background: selectedOption === opt.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: selectedOption === opt.id ? 'var(--c-glow, #38bdf8)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 100ms ease',
            }}
          >
            {opt.count}× {opt.name}
            {opt.pointsDelta !== 0 && (
              <span style={{ color: opt.pointsDelta > 0 ? '#F59E0B' : '#4ADE80', marginLeft: 4 }}>
                ({opt.pointsDelta > 0 ? '+' : ''}{opt.pointsDelta}pts)
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
