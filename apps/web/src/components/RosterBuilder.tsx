// ─────────────────────────────────────────────────────────────────────────────
// BeerHammer — Roster Builder Workbench (§7)
// Full 11th Edition builder supporting all 27 canonical factions,
// subfaction catalogue inheritance, detachment enhancements, and leader attachment
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { compileWahapediaWargear } from '@forceorg/rules-engine-11e';
import { Skeleton } from '@/components/Skeleton';
import type { WargearRuleAST, BattlefieldRole } from '@forceorg/types';

// ── Types ────────────────────────────────────────────────────────────────────

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
  stats?: {
    movement: string;
    toughness: number;
    save: string;
    invulnerableSave?: string;
    wounds: number;
    leadership: string;
    objectiveControl: number;
  };
  weapons?: any[];
  abilities?: any[];
  isLeader?: boolean;
  attachableTo?: string[];
}

export interface EnhancementOption {
  id: string;
  name: string;
  points: number;
  description: string;
}

export interface RosterUnit {
  instanceId: string;
  catalogUnit: CatalogUnit;
  modelCount: number;
  wargearSelections: { ruleId: string; optionId: string; count: number }[];
  pointsCost: number;
  enhancement?: EnhancementOption;
  attachedToInstanceId?: string;
  validationErrors: string[];
}

// ── Role Icons & Metadata ───────────────────────────────────────────────────

const ROLE_META: Record<string, { icon: string; color: string; label: string }> = {
  CHARACTER: { icon: '⚔', color: '#C89D3C', label: 'Character' },
  BATTLELINE: { icon: '🛡', color: '#38BDF8', label: 'Battleline' },
  INFANTRY: { icon: '🎯', color: '#22C55E', label: 'Infantry' },
  VEHICLE: { icon: '🔧', color: '#F97316', label: 'Vehicle' },
  MOUNTED: { icon: '🐴', color: '#A855F7', label: 'Mounted' },
  MONSTER: { icon: '🐉', color: '#EF4444', label: 'Monster' },
  DEDICATED_TRANSPORT: { icon: '🚛', color: '#64748B', label: 'Transport' },
  FORTIFICATION: { icon: '🏰', color: '#94A3B8', label: 'Fortification' },
  OTHER: { icon: '⚡', color: '#CBD5E1', label: 'Other' },
};

// ── Component Props ──────────────────────────────────────────────────────────

export interface RosterBuilderProps {
  factionId?: string;
  subfactionId?: string | null;
  detachmentPrimary?: string | null;
  pointsLimit?: number;
  dpLimit?: number;
  initialUnits?: RosterUnit[];
  onRosterChange?: (units: RosterUnit[]) => void;
}

export const RosterBuilder: React.FC<RosterBuilderProps> = ({
  factionId = 'imperium-space-marines',
  subfactionId,
  detachmentPrimary,
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

  // Catalog and Detachment data
  const [catalog, setCatalog] = useState<CatalogUnit[]>([]);
  const [availableEnhancements, setAvailableEnhancements] = useState<EnhancementOption[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUnits) {
      setRosterUnits(initialUnits);
    }
  }, [initialUnits]);

  // Load faction catalogue dynamically
  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      // Normalize faction ID for file fetch
      let normalizedId = factionId;
      if (normalizedId === 'adeptus_astartes') normalizedId = 'imperium-space-marines';
      if (normalizedId === 'necrons_szarekhan') normalizedId = 'necrons';
      if (normalizedId === 'tau_empire') normalizedId = 't-au-empire';
      if (normalizedId === 'chaos_space_marines') normalizedId = 'chaos-chaos-space-marines';

      const res = await fetch(`${basePath}/data/factions/${normalizedId}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load catalogue (${res.status})`);
      }
      const data = await res.json();

      let unitsList: CatalogUnit[] = (data.datasheets || []).map((ds: any) => ({
        id: ds.id,
        name: ds.name,
        factionId: ds.factionId || normalizedId,
        battlefieldRole: ds.battlefieldRole || 'OTHER',
        basePoints: ds.basePoints || 0,
        dpCost: ds.detachmentPointsCost || 0,
        keywords: ds.keywords || [],
        wargearRulesRaw: '',
        modelComposition: (ds.unitComposition?.models || [{ name: ds.name, count: 1 }]).map((m: any) => ({
          name: m.name || ds.name,
          count: m.count || 1,
        })),
        stats: ds.stats,
        weapons: ds.weapons || [],
        abilities: ds.abilities || [],
        isLeader: !!ds.isLeader,
        attachableTo: ds.attachableTo || [],
      }));

      // If a subfaction is specified (e.g. Blood Angels under Space Marines), merge subfaction units
      if (data.subfactions && Array.isArray(data.subfactions)) {
        const sub = data.subfactions.find((s: any) => s.id === subfactionId);
        if (sub && Array.isArray(sub.datasheets) && sub.datasheets.length > 0) {
          const subUnits: CatalogUnit[] = sub.datasheets.map((ds: any) => ({
            id: ds.id,
            name: ds.name,
            factionId: ds.factionId || sub.id,
            battlefieldRole: ds.battlefieldRole || 'OTHER',
            basePoints: ds.basePoints || 0,
            dpCost: 0,
            keywords: ds.keywords || [],
            wargearRulesRaw: '',
            modelComposition: (ds.unitComposition?.models || [{ name: ds.name, count: 1 }]).map((m: any) => ({
              name: m.name || ds.name,
              count: m.count || 1,
            })),
            stats: ds.stats,
            weapons: ds.weapons || [],
            abilities: ds.abilities || [],
            isLeader: !!ds.isLeader,
            attachableTo: ds.attachableTo || [],
          }));
          unitsList = [...unitsList, ...subUnits];
        }
      }

      setCatalog(unitsList);

      // Extract available Enhancements from active detachment
      if (data.detachments && Array.isArray(data.detachments)) {
        let activeDet = data.detachments.find((d: any) => d.name.toLowerCase() === detachmentPrimary?.toLowerCase());
        if (!activeDet && data.detachments.length > 0) activeDet = data.detachments[0];
        if (activeDet && activeDet.enhancements) {
          setAvailableEnhancements(activeDet.enhancements);
        }
      }
    } catch (err: any) {
      console.warn('[RosterBuilder] Live catalogue fetch failed:', err.message);
      setCatalogError(err.message);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [factionId, subfactionId, detachmentPrimary]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Filtered catalog (Q11=A)
  const filteredCatalog = useMemo(() => {
    return catalog.filter(u => {
      if (catalogRoleFilter !== 'ALL' && u.battlefieldRole !== catalogRoleFilter) return false;
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesKeyword = u.keywords.some(k => k.toLowerCase().includes(q));
        if (!matchesName && !matchesKeyword) return false;
      }
      return true;
    });
  }, [catalog, catalogRoleFilter, catalogSearch]);

  // Roster stats
  const totalPoints = useMemo(() => rosterUnits.reduce((sum, u) => sum + u.pointsCost, 0), [rosterUnits]);
  const totalDP = useMemo(() => rosterUnits.reduce((sum, u) => sum + u.catalogUnit.dpCost, 0), [rosterUnits]);
  const unitCount = rosterUnits.length;

  // Enhancements assigned across army (max 3 in 11e)
  const assignedEnhancementsCount = useMemo(() => {
    return rosterUnits.filter(u => !!u.enhancement).length;
  }, [rosterUnits]);

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
      // Also unbind any units attached to this unit
      const next = prev
        .filter(u => u.instanceId !== instanceId)
        .map(u => u.attachedToInstanceId === instanceId ? { ...u, attachedToInstanceId: undefined } : u);
      onRosterChange?.(next);
      return next;
    });
    if (expandedUnit === instanceId) setExpandedUnit(null);
  }, [onRosterChange, expandedUnit]);

  // Assign enhancement to character (Q12=A)
  const setUnitEnhancement = useCallback((instanceId: string, enhancementId: string | null) => {
    setRosterUnits(prev => {
      const next = prev.map(u => {
        if (u.instanceId !== instanceId) return u;
        if (!enhancementId) {
          return {
            ...u,
            enhancement: undefined,
            pointsCost: u.catalogUnit.basePoints,
          };
        }
        const enh = availableEnhancements.find(e => e.id === enhancementId || e.name === enhancementId);
        if (!enh) return u;
        return {
          ...u,
          enhancement: enh,
          pointsCost: u.catalogUnit.basePoints + enh.points,
        };
      });
      onRosterChange?.(next);
      return next;
    });
  }, [availableEnhancements, onRosterChange]);

  // Link Leader to Bodyguard unit
  const setLeaderAttachment = useCallback((leaderInstanceId: string, bodyguardInstanceId: string | undefined) => {
    setRosterUnits(prev => {
      const next = prev.map(u => {
        if (u.instanceId === leaderInstanceId) {
          return { ...u, attachedToInstanceId: bodyguardInstanceId || undefined };
        }
        return u;
      });
      onRosterChange?.(next);
      return next;
    });
  }, [onRosterChange]);

  // Compile wargear AST for expanded unit
  const wargearAST = useMemo(() => {
    if (!expandedUnit) return [];
    const unit = rosterUnits.find(u => u.instanceId === expandedUnit);
    if (!unit || !unit.catalogUnit.wargearRulesRaw) return [];
    return compileWahapediaWargear(unit.catalogUnit.wargearRulesRaw);
  }, [expandedUnit, rosterUnits]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Roster Summary Bar ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.85rem 1.25rem',
        background: 'rgba(15, 20, 28, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(200, 157, 60, 0.25)',
        borderRadius: '8px',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Points</div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: totalPoints > pointsLimit ? '#EF4444' : '#C89D3C',
            }}>
              {totalPoints} / {pointsLimit}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Units</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC' }}>{unitCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enhancements</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: assignedEnhancementsCount > 3 ? '#EF4444' : '#38BDF8' }}>
              {assignedEnhancementsCount} / 3
            </div>
          </div>
        </div>

        {/* Points Progress Bar */}
        <div style={{ flex: 1, maxWidth: 220, marginLeft: '1rem' }}>
          <div style={{ width: '100%', height: 6, background: '#1E293B', borderRadius: 3 }}>
            <div style={{
              width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%`,
              height: '100%',
              background: totalPoints > pointsLimit ? '#EF4444' : totalPoints > pointsLimit * 0.9 ? '#F59E0B' : '#C89D3C',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <button
          onClick={() => setShowCatalog(!showCatalog)}
          style={{
            padding: '0.55rem 1.25rem',
            background: showCatalog ? 'rgba(200, 157, 60, 0.25)' : 'linear-gradient(135deg, #C89D3C 0%, #D4A843 100%)',
            border: '1px solid #C89D3C',
            borderRadius: '6px',
            color: showCatalog ? '#F8FAFC' : '#070B12',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.85rem',
            boxShadow: '0 2px 10px rgba(200, 157, 60, 0.25)',
          }}
        >
          {showCatalog ? '✕ Close Catalog' : '+ Add Unit to Force'}
        </button>
      </div>

      {/* ── Catalog Browser (Q11=A) ───────────────────────────────────────── */}
      {showCatalog && (
        <div style={{
          padding: '1.25rem',
          background: 'rgba(11, 17, 26, 0.95)',
          border: '1px solid rgba(200, 157, 60, 0.3)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Search bar & Role pills */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍 Search unit by name or keyword (e.g. Terminator, Dreadnought, Tank)..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              style={{
                flex: '1 1 240px',
                padding: '0.55rem 0.85rem',
                fontSize: '0.85rem',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                color: '#F8FAFC',
              }}
            />
          </div>

          {/* Battlefield Role Filter Pills (Q11=A) */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
            {['ALL', 'CHARACTER', 'BATTLELINE', 'INFANTRY', 'VEHICLE', 'MONSTER', 'MOUNTED', 'DEDICATED_TRANSPORT'].map(role => (
              <button
                key={role}
                onClick={() => setCatalogRoleFilter(role)}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: '1px solid',
                  borderColor: catalogRoleFilter === role ? '#C89D3C' : 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  background: catalogRoleFilter === role ? 'rgba(200, 157, 60, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  color: catalogRoleFilter === role ? '#F8FAFC' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                {role === 'ALL' ? '⚡ All Roles' : `${ROLE_META[role]?.icon || ''} ${ROLE_META[role]?.label || role}`}
              </button>
            ))}
          </div>

          {/* Units Grid */}
          {isLoadingCatalog ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>Loading faction armory...</div>
          ) : filteredCatalog.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>No units found matching criteria.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', maxHeight: '340px', overflowY: 'auto' }}>
              {filteredCatalog.map(unit => {
                const role = ROLE_META[unit.battlefieldRole] || ROLE_META.OTHER!;
                return (
                  <div
                    key={unit.id}
                    onClick={() => addUnit(unit)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC' }}>
                        <span style={{ marginRight: '0.35rem' }}>{role.icon}</span>
                        {unit.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: role.color }}>
                        {role.label} {unit.stats ? `• T${unit.stats.toughness} W${unit.stats.wounds}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#C89D3C', whiteSpace: 'nowrap' }}>
                      {unit.basePoints} pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Roster Unit Cards ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rosterUnits.length === 0 ? (
          <div style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: '0.9rem',
            border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.3)',
          }}>
            No units added to this battle force yet. Click <strong style={{ color: '#C89D3C' }}>&quot;+ Add Unit to Force&quot;</strong> to begin building your army list.
          </div>
        ) : (
          rosterUnits.map(unit => {
            const role = ROLE_META[unit.catalogUnit.battlefieldRole] || ROLE_META.OTHER!;
            const isExpanded = expandedUnit === unit.instanceId;
            const isCharacter = unit.catalogUnit.battlefieldRole === 'CHARACTER' || unit.catalogUnit.keywords.includes('CHARACTER');

            // Find attached bodyguard if applicable
            const attachedBodyguard = unit.attachedToInstanceId
              ? rosterUnits.find(u => u.instanceId === unit.attachedToInstanceId)
              : null;

            // Find attached leader if this is a bodyguard
            const attachedLeader = rosterUnits.find(u => u.attachedToInstanceId === unit.instanceId);

            return (
              <div
                key={unit.instanceId}
                style={{
                  background: 'rgba(15, 20, 28, 0.85)',
                  border: isExpanded ? '1px solid #C89D3C' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  transition: 'border-color 150ms ease',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedUnit(isExpanded ? null : unit.instanceId)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>{role.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC' }}>
                        {unit.catalogUnit.name}
                        {unit.enhancement && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(200, 157, 60, 0.2)', border: '1px solid #C89D3C', borderRadius: '3px', color: '#C89D3C' }}>
                            ★ {unit.enhancement.name} (+{unit.enhancement.points}pts)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: role.color, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{role.label} • {unit.modelCount} models</span>
                        {attachedBodyguard && (
                          <span style={{ color: '#38BDF8', fontWeight: 600 }}>
                            ⚔ Leading: {attachedBodyguard.catalogUnit.name}
                          </span>
                        )}
                        {attachedLeader && (
                          <span style={{ color: '#C89D3C', fontWeight: 600 }}>
                            🛡 Commanded by: {attachedLeader.catalogUnit.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#C89D3C' }}>
                      {unit.pointsCost} pts
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeUnit(unit.instanceId); }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#F87171',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                      title="Remove unit"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{
                    padding: '1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.25)',
                  }}>
                    {/* Character Controls: Detachment Enhancements & Bodyguard Attachment (Q12=A) */}
                    {isCharacter && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem', marginBottom: '1rem', padding: '0.85rem', background: 'rgba(200, 157, 60, 0.05)', border: '1px solid rgba(200, 157, 60, 0.2)', borderRadius: '6px' }}>
                        {/* Enhancement Dropdown (Q12=A) */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C89D3C', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                            Detachment Enhancement:
                          </label>
                          <select
                            value={unit.enhancement?.id || ''}
                            onChange={(e) => setUnitEnhancement(unit.instanceId, e.target.value || null)}
                            style={{
                              width: '100%',
                              padding: '0.45rem',
                              fontSize: '0.8rem',
                              backgroundColor: '#0F172A',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '4px',
                              color: '#F8FAFC',
                            }}
                          >
                            <option value="">No Enhancement</option>
                            {availableEnhancements.map(enh => (
                              <option key={enh.id} value={enh.id}>
                                {enh.name} (+{enh.points} pts)
                              </option>
                            ))}
                          </select>
                          {unit.enhancement && (
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.35rem', lineHeight: 1.3 }}>
                              {unit.enhancement.description}
                            </div>
                          )}
                        </div>

                        {/* Leader Attachment Selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                            Attach to Bodyguard Unit:
                          </label>
                          <select
                            value={unit.attachedToInstanceId || ''}
                            onChange={(e) => setLeaderAttachment(unit.instanceId, e.target.value || undefined)}
                            style={{
                              width: '100%',
                              padding: '0.45rem',
                              fontSize: '0.8rem',
                              backgroundColor: '#0F172A',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '4px',
                              color: '#F8FAFC',
                            }}
                          >
                            <option value="">Independent / Not Attached</option>
                            {rosterUnits
                              .filter(u => u.instanceId !== unit.instanceId && u.catalogUnit.battlefieldRole !== 'CHARACTER')
                              .map(bg => (
                                <option key={bg.instanceId} value={bg.instanceId}>
                                  {bg.catalogUnit.name} ({bg.modelCount} models)
                                </option>
                              ))}
                          </select>
                          <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '0.35rem' }}>
                            When attached, this unit shares defensive toughness and wound tracking in Play Mode.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weapons Profile Summary */}
                    {unit.catalogUnit.weapons && unit.catalogUnit.weapons.length > 0 && (
                      <div style={{ marginBottom: '0.85rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                          Weapons Loadout
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {unit.catalogUnit.weapons.map((w: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#0F172A', borderRadius: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{w.name} ({w.type})</span>
                              <span style={{ color: '#CBD5E1' }}>Range: {w.range} • A: {w.attacks} • BS/WS: {w.skill} • S: {w.strength} • AP: {w.armorPenetration} • D: {w.damage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Keywords */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {unit.catalogUnit.keywords.map(kw => (
                        <span key={kw} style={{
                          fontSize: '0.6rem',
                          padding: '2px 6px',
                          background: '#1E293B',
                          borderRadius: 3,
                          border: kw === 'CHARACTER' ? '1px solid #C89D3C' : '1px solid #334155',
                          color: kw === 'CHARACTER' ? '#C89D3C' : '#94A3B8',
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
