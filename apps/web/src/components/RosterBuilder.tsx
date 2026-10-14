// ─────────────────────────────────────────────────────────────────────────────
// BeerHammer — Roster Builder Workbench (§7)
// Full 11th Edition builder supporting all 27 canonical factions,
// subfaction catalogue inheritance, detachment enhancements, and leader attachment
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  compileWahapediaWargear,
  validateWargearLoadout,
  resolveEquippedWeapons,
  buildUnitWargearSlots,
  calculateUnitSquadPoints,
  getUnitBaseModelThreshold,
  WargearSlot,
} from '@forceorg/rules-engine-11e';
import { Skeleton } from '@/components/Skeleton';
import type {
  WargearRuleAST,
  BattlefieldRole,
  WargearSelection,
  EquippedWeaponBadge,
} from '@forceorg/types';

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

export interface DetachmentOption {
  id: string;
  name: string;
  rules: string[];
  enhancements: EnhancementOption[];
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
  wargearSelections: WargearSelection[];
  pointsCost: number;
  enhancement?: EnhancementOption;
  attachedToInstanceId?: string;
  validationErrors: string[];
  needsVerification?: boolean;
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
  onDetachmentChange?: (newDetachmentName: string) => void;
}

export const RosterBuilder: React.FC<RosterBuilderProps> = ({
  factionId = 'imperium-space-marines',
  subfactionId,
  detachmentPrimary,
  pointsLimit = 2000,
  dpLimit = 3,
  initialUnits,
  onRosterChange,
  onDetachmentChange,
}) => {
  const [rosterUnits, setRosterUnits] = useState<RosterUnit[]>(initialUnits || []);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogRoleFilter, setCatalogRoleFilter] = useState<string>('ALL');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  // Catalog and Detachment data
  const [catalog, setCatalog] = useState<CatalogUnit[]>([]);
  const [detachments, setDetachments] = useState<DetachmentOption[]>([]);
  const [activeDetachmentName, setActiveDetachmentName] = useState<string>(detachmentPrimary || '');
  const [selectedDetachmentName, setSelectedDetachmentName] = useState<string>(detachmentPrimary || '');
  const [availableEnhancements, setAvailableEnhancements] = useState<EnhancementOption[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialUnits) {
      const verified = initialUnits.map(u => {
        const baseModels = getUnitBaseModelThreshold(u.catalogUnit);
        const isChar = u.catalogUnit.battlefieldRole === 'CHARACTER' || (u.catalogUnit.keywords || []).includes('EPIC HERO') || baseModels === 1;
        let currentCount = u.modelCount || baseModels;
        // Auto-heal old corrupted model counts from BattleScribe fragments (e.g. 4 or 8 on a 5-man squad, 2 on a 3-man or 5-man squad, or 1 on non-character)
        if (!isChar) {
          if (baseModels === 5 && (currentCount === 4 || currentCount === 2 || currentCount === 1)) {
            currentCount = 5;
          } else if (baseModels === 5 && currentCount === 8) {
            currentCount = 10;
          } else if (baseModels === 3 && (currentCount === 2 || currentCount === 1)) {
            currentCount = 3;
          } else if (baseModels === 10 && (currentCount === 2 || currentCount === 1 || currentCount === 4)) {
            currentCount = 10;
          }
        }
        const squadPoints = calculateUnitSquadPoints({
          basePoints: u.catalogUnit.basePoints,
          modelCount: currentCount,
          baseModelCount: baseModels,
          isCharacter: isChar,
          enhancementPoints: u.enhancement?.points || 0,
        });

        return {
          ...u,
          modelCount: currentCount,
          pointsCost: squadPoints.totalPoints,
          wargearSelections: u.wargearSelections || [],
          validationErrors: u.validationErrors || [],
          needsVerification: u.needsVerification !== undefined ? u.needsVerification : (u.wargearSelections?.length === 0),
        };
      });
      setRosterUnits(verified);
    }
  }, [initialUnits]);

  useEffect(() => {
    if (detachmentPrimary) {
      setActiveDetachmentName(detachmentPrimary);
      setSelectedDetachmentName(detachmentPrimary);
      const det = detachments.find(d => d.name.toLowerCase() === detachmentPrimary.toLowerCase());
      if (det?.enhancements) {
        setAvailableEnhancements(det.enhancements);
      }
    }
  }, [detachmentPrimary, detachments]);

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

      let unitsList: CatalogUnit[] = (data.datasheets || []).map((ds: any) => {
        const baseThreshold = getUnitBaseModelThreshold({
          name: ds.name,
          battlefieldRole: ds.battlefieldRole,
          keywords: ds.keywords,
          basePoints: ds.basePoints,
        });
        const compModels = (ds.unitComposition?.models || [{ name: ds.name, count: 1 }]).map((m: any) => ({
          name: m.name || ds.name,
          count: m.count || 1,
        }));
        const compSum = compModels.reduce((s: number, m: any) => s + m.count, 0);
        if (compSum < baseThreshold && compModels.length > 0) {
          compModels[compModels.length - 1]!.count += (baseThreshold - compSum);
        }

        return {
          id: ds.id,
          name: ds.name,
          factionId: ds.factionId || normalizedId,
          battlefieldRole: ds.battlefieldRole || 'OTHER',
          basePoints: ds.basePoints || 0,
          dpCost: ds.detachmentPointsCost || 0,
          keywords: ds.keywords || [],
          wargearRulesRaw: ds.wargearRules || ds.wargear || ds.wargearOptions || '',
          modelComposition: compModels,
          stats: ds.stats,
          weapons: ds.weapons || [],
          abilities: ds.abilities || [],
          isLeader: !!ds.isLeader,
          attachableTo: ds.attachableTo || [],
        };
      });

      // If a subfaction is specified (e.g. Blood Angels under Space Marines), merge subfaction units
      if (data.subfactions && Array.isArray(data.subfactions)) {
        const sub = data.subfactions.find((s: any) => s.id === subfactionId);
        if (sub && Array.isArray(sub.datasheets) && sub.datasheets.length > 0) {
          const subUnits: CatalogUnit[] = sub.datasheets.map((ds: any) => {
            const baseThreshold = getUnitBaseModelThreshold({
              name: ds.name,
              battlefieldRole: ds.battlefieldRole,
              keywords: ds.keywords,
              basePoints: ds.basePoints,
            });
            const compModels = (ds.unitComposition?.models || [{ name: ds.name, count: 1 }]).map((m: any) => ({
              name: m.name || ds.name,
              count: m.count || 1,
            }));
            const compSum = compModels.reduce((s: number, m: any) => s + m.count, 0);
            if (compSum < baseThreshold && compModels.length > 0) {
              compModels[compModels.length - 1]!.count += (baseThreshold - compSum);
            }

            return {
              id: ds.id,
              name: ds.name,
              factionId: ds.factionId || sub.id,
              battlefieldRole: ds.battlefieldRole || 'OTHER',
              basePoints: ds.basePoints || 0,
              dpCost: 0,
              keywords: ds.keywords || [],
              wargearRulesRaw: ds.wargearRules || ds.wargear || ds.wargearOptions || '',
              modelComposition: compModels,
              stats: ds.stats,
              weapons: ds.weapons || [],
              abilities: ds.abilities || [],
              isLeader: !!ds.isLeader,
              attachableTo: ds.attachableTo || [],
            };
          });
          unitsList = [...unitsList, ...subUnits];
        }
      }

      setCatalog(unitsList);

      // Extract available Detachments and active Enhancements
      if (data.detachments && Array.isArray(data.detachments)) {
        setDetachments(data.detachments);
        let activeDet = data.detachments.find(
          (d: any) => d.name.toLowerCase() === (detachmentPrimary || '').toLowerCase()
        );
        if (!activeDet && data.detachments.length > 0) activeDet = data.detachments[0];
        if (activeDet) {
          const detName = activeDet.name;
          setActiveDetachmentName(detName);
          setSelectedDetachmentName(detName);
          if (activeDet.enhancements) {
            setAvailableEnhancements(activeDet.enhancements);
          }
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
    const baseModels = getUnitBaseModelThreshold(catalogUnit);
    const newUnit: RosterUnit = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      catalogUnit,
      modelCount: baseModels,
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
        const baseModels = getUnitBaseModelThreshold(u.catalogUnit);
        const isChar = u.catalogUnit.battlefieldRole === 'CHARACTER' || (u.catalogUnit.keywords || []).includes('EPIC HERO') || baseModels === 1;

        if (!enhancementId) {
          const squadPoints = calculateUnitSquadPoints({
            basePoints: u.catalogUnit.basePoints,
            modelCount: u.modelCount,
            baseModelCount: baseModels,
            isCharacter: isChar,
            enhancementPoints: 0,
          });
          return {
            ...u,
            enhancement: undefined,
            pointsCost: squadPoints.totalPoints,
          };
        }
        const enh = availableEnhancements.find(e => e.id === enhancementId || e.name === enhancementId);
        if (!enh) return u;
        const squadPoints = calculateUnitSquadPoints({
          basePoints: u.catalogUnit.basePoints,
          modelCount: u.modelCount,
          baseModelCount: baseModels,
          isCharacter: isChar,
          enhancementPoints: enh.points,
        });
        return {
          ...u,
          enhancement: enh,
          pointsCost: squadPoints.totalPoints,
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

  // Squad Special/Heavy weapon stepper with hard clamping & instant alert (Q3=B, Q6=A+B)
  const handleWargearCountChange = useCallback((
    instanceId: string,
    ruleId: string,
    optionId: string,
    weaponName: string,
    replacesName: string | undefined,
    delta: number,
    maxAllowed: number,
    scaleFactor?: number
  ) => {
    setRosterUnits(prev => {
      const unit = prev.find(u => u.instanceId === instanceId);
      if (!unit) return prev;

      // Current count for this rule across all options
      const currentRuleSelections = unit.wargearSelections.filter(s => s.ruleId === ruleId);
      const currentTotalForRule = currentRuleSelections.reduce((sum, s) => sum + s.count, 0);

      if (delta > 0 && currentTotalForRule >= maxAllowed) {
        // Q6=A: Instant explanatory red alert on attempt
        setToastMessage(`⚠️ Tournament Legality Notice: Cannot equip [${weaponName}]. Tournament limit is ${maxAllowed} for this unit (${scaleFactor ? `1 per ${scaleFactor} models` : `max ${maxAllowed}`}).`);
        setTimeout(() => setToastMessage(null), 4000);
        return prev;
      }

      // Compute new selections
      const existingIdx = unit.wargearSelections.findIndex(s => s.ruleId === ruleId && s.selectedOptionId === optionId);
      let updatedSelections = [...unit.wargearSelections];

      if (existingIdx >= 0) {
        const existing = updatedSelections[existingIdx]!;
        const newCount = existing.count + delta;
        if (newCount <= 0) {
          updatedSelections.splice(existingIdx, 1);
        } else {
          updatedSelections[existingIdx] = {
            ...existing,
            count: newCount,
          };
        }
      } else if (delta > 0) {
        const isAddon = ruleId === 'rule_addon' || ruleId === 'rule_support_wargear' || ruleId.includes('addon') || ruleId.includes('support');
        updatedSelections.push({
          ruleId,
          selectedOptionId: optionId,
          weaponName,
          replacesWeaponName: replacesName,
          count: delta,
          role: isAddon ? 'ADD_ON' : 'TROOPER',
        });
      }

      const rules = unit.catalogUnit.wargearRulesRaw ? compileWahapediaWargear(unit.catalogUnit.wargearRulesRaw) : [];
      const validation = validateWargearLoadout({
        modelCount: unit.modelCount,
        wargearSelections: updatedSelections,
        rules,
        catalogWeapons: unit.catalogUnit.weapons,
      });

      const next = prev.map(u => {
        if (u.instanceId !== instanceId) return u;
        return {
          ...u,
          wargearSelections: updatedSelections,
          validationErrors: validation.errors.map(e => e.message),
          needsVerification: false,
        };
      });

      onRosterChange?.(next);
      return next;
    });
  }, [onRosterChange]);

  // Leader / Sergeant weapon swap handler (Q7=A)
  const handleLeaderOptionChange = useCallback((
    instanceId: string,
    ruleId: string,
    optionId: string,
    weaponName: string,
    replacesName: string | undefined
  ) => {
    setRosterUnits(prev => {
      const unit = prev.find(u => u.instanceId === instanceId);
      if (!unit) return prev;

      let updatedSelections = unit.wargearSelections.filter(s => s.ruleId !== ruleId);
      if (optionId && optionId !== 'default') {
        updatedSelections.push({
          ruleId,
          selectedOptionId: optionId,
          weaponName,
          replacesWeaponName: replacesName,
          count: 1,
          role: 'SERGEANT',
        });
      }

      const rules = unit.catalogUnit.wargearRulesRaw ? compileWahapediaWargear(unit.catalogUnit.wargearRulesRaw) : [];
      const validation = validateWargearLoadout({
        modelCount: unit.modelCount,
        wargearSelections: updatedSelections,
        rules,
        catalogWeapons: unit.catalogUnit.weapons,
      });

      const next = prev.map(u => {
        if (u.instanceId !== instanceId) return u;
        return {
          ...u,
          wargearSelections: updatedSelections,
          validationErrors: validation.errors.map(e => e.message),
          needsVerification: false,
        };
      });

      onRosterChange?.(next);
      return next;
    });
  }, [onRosterChange]);

  // Model Count Change & Squad Down-sizing (Q5=B, Q8=C)
  const handleModelCountChange = useCallback((instanceId: string, deltaOrTarget: number, isAbsolute: boolean = false) => {
    setRosterUnits(prev => {
      const next = prev.map(u => {
        if (u.instanceId !== instanceId) return u;
        const minModels = 1;
        const maxModels = 30;
        const newCount = isAbsolute
          ? Math.max(minModels, Math.min(maxModels, deltaOrTarget))
          : Math.max(minModels, Math.min(maxModels, u.modelCount + deltaOrTarget));
        if (newCount === u.modelCount) return u;

        // Q5=B, Q8=C: If squad size drops, reset special weapons to baseline legal loadout
        let newSelections = [...u.wargearSelections];
        if (newCount < u.modelCount) {
          newSelections = newSelections.filter(s => s.role === 'SERGEANT' || s.role === 'ADD_ON');
          setToastMessage(`✓ Squad reduced to ${newCount} models. Special weapons reset to tournament-legal baseline.`);
          setTimeout(() => setToastMessage(null), 3500);
        }

        const baseModels = getUnitBaseModelThreshold(u.catalogUnit);
        const isChar = u.catalogUnit.battlefieldRole === 'CHARACTER' || (u.catalogUnit.keywords || []).includes('EPIC HERO') || baseModels === 1;
        const squadPoints = calculateUnitSquadPoints({
          basePoints: u.catalogUnit.basePoints,
          modelCount: newCount,
          baseModelCount: baseModels,
          isCharacter: isChar,
          enhancementPoints: u.enhancement?.points || 0,
        });

        if (squadPoints.isUnderstrength) {
          setToastMessage(`⚠️ ${newCount} models selected (${squadPoints.tierMaxModels}-model squad tier: ${squadPoints.totalPoints} pts).`);
          setTimeout(() => setToastMessage(null), 3500);
        }

        const rules = u.catalogUnit.wargearRulesRaw ? compileWahapediaWargear(u.catalogUnit.wargearRulesRaw) : [];
        const validation = validateWargearLoadout({
          modelCount: newCount,
          wargearSelections: newSelections,
          rules,
          catalogWeapons: u.catalogUnit.weapons,
        });

        return {
          ...u,
          modelCount: newCount,
          pointsCost: squadPoints.totalPoints,
          wargearSelections: newSelections,
          validationErrors: validation.errors.map(e => e.message),
          needsVerification: false,
        };
      });
      onRosterChange?.(next);
      return next;
    });
  }, [onRosterChange]);

  // Confirm unit loadout as tournament-legal (Q11=B)
  const handleConfirmUnitLoadout = useCallback((instanceId: string) => {
    setRosterUnits(prev => {
      const next = prev.map(u => u.instanceId === instanceId ? { ...u, needsVerification: false } : u);
      onRosterChange?.(next);
      return next;
    });
    setToastMessage('✓ Wargear loadout verified as tournament-legal.');
    setTimeout(() => setToastMessage(null), 3000);
  }, [onRosterChange]);

  // Handle Detachment Switch & Enhancement Reset (Q6)
  const handleApplyDetachment = useCallback(() => {
    if (!selectedDetachmentName || selectedDetachmentName === activeDetachmentName) return;

    const newDet = detachments.find(d => d.name === selectedDetachmentName);
    if (!newDet) return;

    setActiveDetachmentName(selectedDetachmentName);
    setAvailableEnhancements(newDet.enhancements || []);

    // Q6: always remove enhancements with no prompt
    const hadEnhancements = rosterUnits.some(u => !!u.enhancement);
    const updatedUnits = rosterUnits.map(u => {
      if (u.enhancement) {
        const baseModels = getUnitBaseModelThreshold(u.catalogUnit);
        const isChar = u.catalogUnit.battlefieldRole === 'CHARACTER' || (u.catalogUnit.keywords || []).includes('EPIC HERO') || baseModels === 1;
        const squadPoints = calculateUnitSquadPoints({
          basePoints: u.catalogUnit.basePoints,
          modelCount: u.modelCount,
          baseModelCount: baseModels,
          isCharacter: isChar,
          enhancementPoints: 0,
        });
        return {
          ...u,
          enhancement: undefined,
          pointsCost: squadPoints.totalPoints,
        };
      }
      return u;
    });

    setRosterUnits(updatedUnits);
    onRosterChange?.(updatedUnits);
    onDetachmentChange?.(selectedDetachmentName);

    setToastMessage(
      hadEnhancements
        ? `✓ Detachment changed to ${selectedDetachmentName}. Previous enhancements unequipped.`
        : `✓ Detachment changed to ${selectedDetachmentName}.`
    );
    setTimeout(() => setToastMessage(null), 3500);
  }, [selectedDetachmentName, activeDetachmentName, detachments, rosterUnits, onRosterChange, onDetachmentChange]);

  const previewDetachment = useMemo(() => {
    return detachments.find(d => d.name === selectedDetachmentName) || detachments.find(d => d.name === activeDetachmentName) || null;
  }, [detachments, selectedDetachmentName, activeDetachmentName]);

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

      {/* ── DEDICATED DETACHMENT RULES & ENHANCEMENTS BAR ────────────────── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(200, 157, 60, 0.3)',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Header row: Active Detachment badge + Dropdown + Apply button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              padding: '0.4rem 0.85rem',
              background: 'rgba(200, 157, 60, 0.15)',
              border: '1px solid #C89D3C',
              borderRadius: '6px',
              color: '#C89D3C',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <span>⚡ Active Detachment:</span>
              <strong style={{ color: '#F8FAFC' }}>{activeDetachmentName || 'Standard Detachment'}</strong>
            </div>

            {/* Detachment dropdown selector (Q5=B) */}
            {detachments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="detachment-select" style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
                  Switch Detachment:
                </label>
                <select
                  id="detachment-select"
                  value={selectedDetachmentName}
                  onChange={(e) => setSelectedDetachmentName(e.target.value)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: '#0F172A',
                    border: selectedDetachmentName !== activeDetachmentName ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {detachments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name} {d.name === activeDetachmentName ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Apply Changes button (Q7=B: disabled when current, active & pulsating when changed) */}
          <button
            onClick={handleApplyDetachment}
            disabled={selectedDetachmentName === activeDetachmentName}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              borderRadius: '6px',
              cursor: selectedDetachmentName === activeDetachmentName ? 'not-allowed' : 'pointer',
              opacity: selectedDetachmentName === activeDetachmentName ? 0.45 : 1,
              background: selectedDetachmentName === activeDetachmentName
                ? '#1E293B'
                : 'linear-gradient(135deg, #C89D3C 0%, #F59E0B 100%)',
              border: selectedDetachmentName === activeDetachmentName
                ? '1px solid rgba(255,255,255,0.1)'
                : '1px solid #FCD34D',
              color: selectedDetachmentName === activeDetachmentName ? '#94A3B8' : '#070B12',
              boxShadow: selectedDetachmentName !== activeDetachmentName
                ? '0 0 16px rgba(200, 157, 60, 0.5), 0 0 6px rgba(245, 158, 11, 0.8)'
                : 'none',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>{selectedDetachmentName !== activeDetachmentName ? '⚡' : '✓'}</span>
            <span>Apply Changes</span>
          </button>
        </div>

        {/* Selected Detachment Rules & 4 Enhancements Preview */}
        {previewDetachment && (
          <div style={{
            padding: '0.85rem 1rem',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {previewDetachment.name} — Detachment Rules & Enhancements:
              </div>
              {selectedDetachmentName !== activeDetachmentName && (
                <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
                  ⚠️ Previewing new detachment (Click &quot;Apply Changes&quot; to activate)
                </span>
              )}
            </div>

            {previewDetachment.rules && previewDetachment.rules.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '0.6rem' }}>
                <strong style={{ color: '#E2E8F0' }}>Detachment Rules:</strong> {previewDetachment.rules.join(', ')}
              </div>
            )}

            {/* 4 Enhancements preview */}
            {previewDetachment.enhancements && previewDetachment.enhancements.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Available Enhancements ({previewDetachment.enhancements.length}):
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '0.5rem',
                }}>
                  {previewDetachment.enhancements.map((enh, i) => (
                    <div
                      key={enh.id || i}
                      style={{
                        padding: '0.5rem 0.65rem',
                        background: '#0F172A',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.75rem', color: '#F8FAFC' }}>{enh.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: '#C89D3C', fontWeight: 800 }}>+{enh.points} pts</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', lineHeight: 1.3 }}>
                        {enh.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div style={{
            padding: '0.5rem 0.85rem',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22C55E',
            borderRadius: '4px',
            color: '#4ADE80',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}>
            {toastMessage}
          </div>
        )}
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
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span>{unit.catalogUnit.name}</span>
                        {unit.enhancement && (
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(200, 157, 60, 0.2)', border: '1px solid #C89D3C', borderRadius: '3px', color: '#C89D3C' }}>
                            ★ {unit.enhancement.name} (+{unit.enhancement.points}pts)
                          </span>
                        )}
                        {unit.needsVerification && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #EAB308', borderRadius: '3px', color: '#FACC15', fontWeight: 700 }}>
                            ⚠️ Needs Verification
                          </span>
                        )}
                        {unit.validationErrors && unit.validationErrors.length > 0 && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', borderRadius: '3px', color: '#F87171', fontWeight: 700 }}>
                            🚫 Illegal Loadout
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
                            When attached, this unit is deployed together with its bodyguard in Battle Mode.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Needs Verification Alert Banner (Q11=B) ──────── */}
                    {unit.needsVerification && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.85rem',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid #EAB308',
                        borderRadius: '6px',
                        marginBottom: '0.85rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#FEF08A', fontWeight: 600 }}>
                          ⚠️ <strong>Needs Verification:</strong> Review wargear selections following rules or roster updates to confirm tournament legality.
                        </div>
                        <button
                          onClick={() => handleConfirmUnitLoadout(unit.instanceId)}
                          style={{
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: '#EAB308',
                            color: '#070B12',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Confirm Legal
                        </button>
                      </div>
                    )}

                    {/* ── Model Count Scaling Control (Q5=B, Q8=C) ──────── */}
                    {!isCharacter && (() => {
                      const baseModels = getUnitBaseModelThreshold(unit.catalogUnit);
                        const pointsInfo = calculateUnitSquadPoints({
                          basePoints: unit.catalogUnit.basePoints,
                          modelCount: unit.modelCount,
                          baseModelCount: baseModels,
                          isCharacter: isCharacter,
                          enhancementPoints: unit.enhancement?.points || 0,
                        });

                        return (
                          <div style={{
                            padding: '0.65rem 0.85rem',
                            background: '#0F172A',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            marginBottom: '0.85rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2E8F0' }}>
                                  Squad Model Count & Point Tier
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                                  Baseline: {baseModels} models ({unit.catalogUnit.basePoints} pts) • Current: {pointsInfo.tierMaxModels}-model tier ({pointsInfo.totalPoints} pts)
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleModelCountChange(unit.instanceId, -1)}
                                  disabled={unit.modelCount <= 1}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '4px',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid #EF4444',
                                    color: '#F87171',
                                    fontWeight: 800,
                                    cursor: unit.modelCount <= 1 ? 'not-allowed' : 'pointer',
                                  }}
                                  title="Reduce squad size"
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#F8FAFC', minWidth: '85px', textAlign: 'center' }}>
                                  {unit.modelCount} models
                                </span>
                                <button
                                  onClick={() => handleModelCountChange(unit.instanceId, 1)}
                                  disabled={unit.modelCount >= 30}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '4px',
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    border: '1px solid #22C55E',
                                    color: '#4ADE80',
                                    fontWeight: 800,
                                    cursor: unit.modelCount >= 30 ? 'not-allowed' : 'pointer',
                                  }}
                                  title="Increase squad size"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Quick Squad Tier Buttons */}
                            {baseModels > 1 && (
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Quick Tiers:</span>
                                <button
                                  onClick={() => handleModelCountChange(unit.instanceId, baseModels, true)}
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    borderRadius: '3px',
                                    border: unit.modelCount === baseModels ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                                    background: unit.modelCount === baseModels ? 'rgba(56, 189, 248, 0.2)' : '#1E293B',
                                    color: unit.modelCount === baseModels ? '#38BDF8' : '#94A3B8',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {baseModels} Models ({unit.catalogUnit.basePoints} pts)
                                </button>
                                <button
                                  onClick={() => handleModelCountChange(unit.instanceId, baseModels * 2, true)}
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    borderRadius: '3px',
                                    border: unit.modelCount === baseModels * 2 ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                                    background: unit.modelCount === baseModels * 2 ? 'rgba(56, 189, 248, 0.2)' : '#1E293B',
                                    color: unit.modelCount === baseModels * 2 ? '#38BDF8' : '#94A3B8',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {baseModels * 2} Models ({unit.catalogUnit.basePoints * 2} pts)
                                </button>
                              </div>
                            )}

                            {/* Understrength Notification Banner */}
                            {pointsInfo.isUnderstrength && (
                              <div style={{
                                marginTop: '0.45rem',
                                padding: '0.35rem 0.6rem',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid #F59E0B',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: '#FCD34D',
                                fontWeight: 600,
                              }}>
                                ⚠️ Understrength squad: {unit.modelCount} models incurs the full points value of a {pointsInfo.tierMaxModels}-man squad ({pointsInfo.totalPoints} pts).
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* ── Active Tournament Legality Errors ─────────────── */}
                    {unit.validationErrors && unit.validationErrors.length > 0 && (
                      <div style={{
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #EF4444',
                        borderRadius: '6px',
                        marginBottom: '0.85rem',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F87171', marginBottom: '0.25rem' }}>
                          🚫 Tournament Legality Violations:
                        </div>
                        {unit.validationErrors.map((err, idx) => (
                          <div key={idx} style={{ fontSize: '0.7rem', color: '#FCA5A5' }}>
                            • {err}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Role-Grouped Wargear Options (Q7=A) ───────────── */}
                    {(() => {
                      const wargearSlots = buildUnitWargearSlots({
                        catalogWeapons: unit.catalogUnit.weapons || [],
                        wargearRules: unit.catalogUnit.wargearRulesRaw
                          ? compileWahapediaWargear(unit.catalogUnit.wargearRulesRaw)
                          : [],
                        isLeader: isCharacter,
                        modelCount: unit.modelCount,
                        abilities: unit.catalogUnit.abilities || [],
                        unitName: unit.catalogUnit.name,
                        keywords: unit.catalogUnit.keywords || [],
                      });

                      const hasAnySlots =
                        wargearSlots.leaderSlots.length > 0 ||
                        wargearSlots.squadSpecialSlots.length > 0 ||
                        wargearSlots.addOnSlots.length > 0;

                      return (
                        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ⚙️ Wargear Configuration & Tournament Quotas
                          </div>

                          {/* Leader / Sergeant Equipment (Q7=A) */}
                          {wargearSlots.leaderSlots.length > 0 && (
                            <div style={{ padding: '0.75rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#C89D3C', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                👑 {isCharacter ? 'Character Armament' : 'Unit Leader / Sergeant Loadout'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {wargearSlots.leaderSlots.map(slot => {
                                  const currentSel = unit.wargearSelections.find(s => s.ruleId === slot.ruleId);
                                  const selectedVal = currentSel ? currentSel.selectedOptionId : 'default';

                                  return (
                                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.75rem', color: '#E2E8F0', fontWeight: 600 }}>
                                        {slot.title}:
                                      </span>
                                      <select
                                        value={selectedVal}
                                        onChange={(e) => {
                                          const optId = e.target.value;
                                          if (optId === 'default') {
                                            handleLeaderOptionChange(unit.instanceId, slot.ruleId, '', '', slot.replacesName);
                                          } else {
                                            const opt = slot.options.find(o => o.id === optId);
                                            handleLeaderOptionChange(unit.instanceId, slot.ruleId, optId, opt?.name || optId, slot.replacesName);
                                          }
                                        }}
                                        style={{
                                          padding: '0.35rem 0.65rem',
                                          fontSize: '0.75rem',
                                          backgroundColor: '#1E293B',
                                          border: '1px solid rgba(255,255,255,0.15)',
                                          borderRadius: '4px',
                                          color: '#F8FAFC',
                                          cursor: 'pointer',
                                          maxWidth: '240px',
                                        }}
                                      >
                                        <option value="default">Standard ({slot.replacesName || 'Default'})</option>
                                        {slot.options.map(opt => (
                                          <option key={opt.id} value={opt.id}>
                                            {opt.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Standard Squad Baseline Armament */}
                          {!isCharacter && (wargearSlots.primaryRangedWeapon || wargearSlots.baseTroopMeleeWeapon) && (() => {
                            const specialRangedTotal = unit.wargearSelections
                              .filter(s => s.ruleId === 'slot_squad_special' || s.ruleId === 'slot_squad_trooper_ranged')
                              .reduce((sum, s) => sum + s.count, 0);
                            const standardRangedCount = Math.max(0, unit.modelCount - specialRangedTotal);

                            const specialMeleeTotal = unit.wargearSelections
                              .filter(s => s.ruleId === 'slot_squad_melee')
                              .reduce((sum, s) => sum + s.count, 0);
                            const standardMeleeCount = Math.max(0, unit.modelCount - specialMeleeTotal);

                            return (
                              <div style={{ padding: '0.65rem 0.75rem', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                                  🛡️ Standard Squad Armament
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {wargearSlots.primaryRangedWeapon && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                      <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span>🔫</span> <strong>{wargearSlots.primaryRangedWeapon.name}</strong> <span style={{ color: '#64748B', fontSize: '0.7rem' }}>(Default Ranged)</span>
                                      </span>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                        {standardRangedCount} / {unit.modelCount} equipped
                                      </span>
                                    </div>
                                  )}
                                  {wargearSlots.baseTroopMeleeWeapon && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                      <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span>⚔️</span> <strong>{wargearSlots.baseTroopMeleeWeapon.name}</strong> <span style={{ color: '#64748B', fontSize: '0.7rem' }}>(Default Melee)</span>
                                      </span>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#C89D3C', background: 'rgba(200, 157, 60, 0.12)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(200, 157, 60, 0.25)' }}>
                                        {standardMeleeCount} / {unit.modelCount} equipped
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Squad Special & Heavy Weapons (Q7=A, Q6=A+B) */}
                          {wargearSlots.squadSpecialSlots.length > 0 && (
                            <div style={{ padding: '0.75rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                              {wargearSlots.squadSpecialSlots.map(slot => {
                                const currentTotal = unit.wargearSelections
                                  .filter(s => s.ruleId === slot.ruleId)
                                  .reduce((sum, s) => sum + s.count, 0);
                                const isAtLimit = currentTotal >= slot.maxAllowed;

                                return (
                                  <div key={slot.id} style={{ marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase' }}>
                                        🎯 {slot.title}
                                      </span>
                                      <span style={{
                                        fontSize: '0.65rem',
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        background: isAtLimit ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                                        border: isAtLimit ? '1px solid #EF4444' : '1px solid rgba(56, 189, 248, 0.3)',
                                        color: isAtLimit ? '#F87171' : '#38BDF8',
                                        fontWeight: 700,
                                      }}>
                                        {currentTotal} / {slot.maxAllowed} equipped {isAtLimit ? '(Max)' : ''}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {slot.options.map(opt => {
                                        const sel = unit.wargearSelections.find(s => s.ruleId === slot.ruleId && s.selectedOptionId === opt.id);
                                        const count = sel?.count || 0;
                                        const canAddMore = currentTotal < slot.maxAllowed;

                                        return (
                                          <div
                                            key={opt.id}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '0.35rem 0.65rem',
                                              background: 'rgba(15, 23, 42, 0.6)',
                                              border: '1px solid rgba(255, 255, 255, 0.06)',
                                              borderRadius: '4px',
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F8FAFC' }}>
                                                {opt.name}
                                              </span>
                                              {isAtLimit && count === 0 && (
                                                <span style={{ fontSize: '0.6rem', color: '#94A3B8' }}>
                                                  🔒 Locked (Quota full)
                                                </span>
                                              )}
                                            </div>

                                            {/* Stepper with Hard Clamping & Alert on Click (Q6=A+B) */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                              <button
                                                onClick={() => handleWargearCountChange(unit.instanceId, slot.ruleId, opt.id, opt.name, slot.replacesName, -1, slot.maxAllowed, slot.scaleFactor)}
                                                disabled={count <= 0}
                                                style={{
                                                  width: '22px',
                                                  height: '22px',
                                                  borderRadius: '3px',
                                                  background: count > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                                                  border: '1px solid',
                                                  borderColor: count > 0 ? '#EF4444' : 'rgba(255,255,255,0.1)',
                                                  color: count > 0 ? '#F87171' : '#64748B',
                                                  fontWeight: 800,
                                                  fontSize: '0.75rem',
                                                  cursor: count > 0 ? 'pointer' : 'not-allowed',
                                                }}
                                              >
                                                -
                                              </button>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 800, minWidth: '18px', textAlign: 'center', color: count > 0 ? '#38BDF8' : '#94A3B8' }}>
                                                {count}
                                              </span>
                                              <button
                                                onClick={() => handleWargearCountChange(unit.instanceId, slot.ruleId, opt.id, opt.name, slot.replacesName, 1, slot.maxAllowed, slot.scaleFactor)}
                                                style={{
                                                  width: '22px',
                                                  height: '22px',
                                                  borderRadius: '3px',
                                                  background: canAddMore ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                  border: '1px solid',
                                                  borderColor: canAddMore ? '#38BDF8' : 'rgba(239, 68, 68, 0.3)',
                                                  color: canAddMore ? '#38BDF8' : '#F87171',
                                                  fontWeight: 800,
                                                  fontSize: '0.75rem',
                                                  cursor: 'pointer',
                                                }}
                                                title={canAddMore ? `Equip ${opt.name}` : `Quota full (${slot.maxAllowed}/${slot.maxAllowed})`}
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Optional Squad Add-ons (Q7=A) */}
                          {wargearSlots.addOnSlots.length > 0 && (
                            <div style={{ padding: '0.75rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                🛡 Optional Squad Equipment
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {wargearSlots.addOnSlots.flatMap(slot => slot.options).map(opt => {
                                  const isEquipped = unit.wargearSelections.some(s => s.selectedOptionId === opt.id && s.count > 0);
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        handleWargearCountChange(
                                          unit.instanceId,
                                          'rule_addon',
                                          opt.id,
                                          opt.name,
                                          undefined,
                                          isEquipped ? -1 : 1,
                                          unit.modelCount
                                        );
                                      }}
                                      style={{
                                        padding: '0.3rem 0.65rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        border: '1px solid',
                                        borderColor: isEquipped ? '#A855F7' : 'rgba(255, 255, 255, 0.1)',
                                        background: isEquipped ? 'rgba(168, 85, 247, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                                        color: isEquipped ? '#F8FAFC' : '#94A3B8',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isEquipped ? '✓ ' : '+ '}{opt.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {!hasAnySlots && (
                            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>
                              Fixed factory armament. No alternate wargear options available for this unit.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Live Active Tabletop Armament (Filtered Preview) ── */}
                    {unit.catalogUnit.weapons && unit.catalogUnit.weapons.length > 0 && (
                      <div style={{ marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ⚡ Active Tabletop Armament (Deployable in Battle Mode)
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                            Only selected weapons will be active
                          </span>
                        </div>

                        {/* Resolved equipped weapons with model count badges */}
                        {(() => {
                          const equipped = resolveEquippedWeapons(
                            unit.catalogUnit.weapons,
                            unit.modelCount,
                            unit.wargearSelections,
                            isCharacter
                          );

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {equipped.map((w, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.55rem',
                                    background: '#0F172A',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '4px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.4rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{
                                      padding: '1px 6px',
                                      borderRadius: '3px',
                                      background: 'rgba(34, 197, 94, 0.2)',
                                      border: '1px solid #22C55E',
                                      color: '#4ADE80',
                                      fontWeight: 800,
                                      fontSize: '0.7rem',
                                    }}>
                                      {w.count}x
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
                                      {w.name} ({w.type})
                                    </span>
                                  </div>
                                  <span style={{ color: '#CBD5E1', fontSize: '0.7rem' }}>
                                    Range: {w.range} • A: {w.attacks} • BS/WS: {w.skill} • S: {w.strength} • AP: {w.armorPenetration} • D: {w.damage}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
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
