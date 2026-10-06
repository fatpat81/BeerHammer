// ─────────────────────────────────────────────────────────────────────────────
// BeerHammer — Battle Mode Tabletop Console
// Route: /army/[id]
// Distinct Battle Mode HUD with interactive Phase Bar, CP Generator,
// Single-Accordion Force Org, Phase-Specific Datacards, and In-Card Phase Stratagems
// (NO wound counters or health bars on cards per specification)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ThemeProvider, ChapterIcon } from '@forceorg/ui-theme';
import { FactionSelector } from '@/components/FactionSelector';
import { ComplianceDashboard } from '@/components/ComplianceDashboard';
import { FullPageSkeleton } from '@/components/Skeleton';
import { fetchRoster, fetchDatasheets } from '@/lib/api';
import type { UserArmy, Datasheet, BattlePhase, Stratagem } from '@forceorg/types';
import type { RosterUnit } from '@/components/RosterBuilder';

// Core 11th Edition Stratagems
const CORE_STRATAGEMS: Stratagem[] = [
  { id: 'core-command-reroll', name: 'Command Re-roll', cpCost: 1, phase: 'ANY', category: 'CORE', description: 'Re-roll one Hit roll, Wound roll, Damage roll, saving throw, Advance roll, Charge roll, Desperate Escape test, or Hazard test.', requiredKeywords: [] },
  { id: 'core-counter-offensive', name: 'Counter-Offensive', cpCost: 2, phase: 'FIGHT', category: 'CORE', description: 'Interrupt combat sequence immediately after an enemy unit has fought to fight with one eligible unit from your army.', requiredKeywords: [] },
  { id: 'core-rapid-ingress', name: 'Rapid Ingress', cpCost: 1, phase: 'MOVEMENT', category: 'CORE', description: 'Your unit can arrive from Reserves as if it were the Reinforcements step of your Movement phase, during your opponent’s turn.', requiredKeywords: ['DEEP STRIKE'] },
  { id: 'core-heroic-intervention', name: 'Heroic Intervention', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Declare a counter-charge with one eligible unit after an enemy unit completes a charge move within 6" of that unit.', requiredKeywords: ['CHARACTER', 'VEHICLE', 'WALKER'] },
  { id: 'core-smokescreen', name: 'Smokescreen', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Target unit gains the Benefit of Cover and the Stealth ability until the end of the phase.', requiredKeywords: ['SMOKE'] },
  { id: 'core-tank-shock', name: 'Tank Shock', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Select one enemy unit within Engagement Range after completing a Charge move; roll dice equal to your vehicle toughness and inflict mortal wounds on 5+.', requiredKeywords: ['VEHICLE'] },
  { id: 'core-go-to-ground', name: 'Go to Ground', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Target unit gains the Benefit of Cover and a 6+ invulnerable save until the end of the phase.', requiredKeywords: ['INFANTRY'] },
  { id: 'core-grenade', name: 'Grenade', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Select one enemy unit within 8" and visible to this unit; roll six D6, each 4+ causes 1 mortal wound.', requiredKeywords: ['GRENADES'] },
  { id: 'core-insane-bravery', name: 'Insane Bravery', cpCost: 1, phase: 'COMMAND', category: 'CORE', description: 'Target unit automatically passes a Battle-shock test that it just failed in your Command phase.', requiredKeywords: [] },
  { id: 'core-fire-overwatch', name: 'Fire Overwatch', cpCost: 1, phase: 'MOVEMENT', category: 'CORE', description: 'Shoot at an enemy unit that moves, advances, or charges within 24". Hits on unmodified 6s only.', requiredKeywords: [] },
];

export default function BattleModeConsolePage() {
  const params = useParams();
  const router = useRouter();
  const armyId = params.id as string;

  const [army, setArmy] = useState<UserArmy | null>(null);
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);

  // ── Battle Mode State ─────────────────────────────────────────────────────
  const [battleRound, setBattleRound] = useState<number>(1);
  const [commandPoints, setCommandPoints] = useState<number>(1);
  const [activePhase, setActivePhase] = useState<BattlePhase>('COMMAND');
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Show notification toast
  const showToast = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Fetch Roster Data ─────────────────────────────────────────────────────
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
        console.warn('[BattleMode] Fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [armyId]);

  // ── Compute Display Units (Single-Page Force Org) ─────────────────────────
  const unitsList = useMemo(() => {
    const payloadUnits: RosterUnit[] = (army?.rosterPayload as any)?.units || [];
    if (payloadUnits.length === 0) return [];

    const baseDisplayUnits = payloadUnits.map((puRaw, i) => {
      const pu = puRaw as any;
      const catalogUnit = pu.catalogUnit ?? {
        id: pu.datasheetId ?? `ds_${i}`,
        name: pu.datasheetName ?? 'Unit',
        factionId: army?.factionId ?? 'imperium-space-marines',
        battlefieldRole: 'INFANTRY',
        basePoints: pu.pointsCost ?? 0,
        keywords: [],
        modelComposition: [{ name: pu.datasheetName ?? 'Model', count: pu.modelCount ?? 1 }],
      };
      const ds = datasheets.find(d => d.id === catalogUnit.id || d.name === catalogUnit.name);
      const dsStats = ds?.stats as any;

      return {
        instanceId: pu.instanceId,
        attachedToInstanceId: pu.attachedToInstanceId,
        enhancement: pu.enhancement,
        name: catalogUnit.name,
        role: catalogUnit.battlefieldRole,
        points: pu.pointsCost,
        keywords: (catalogUnit.keywords || []).map((k: string) => k.toUpperCase()),
        stats: {
          movement: dsStats?.movement || '6"',
          toughness: dsStats?.toughness || 4,
          save: dsStats?.save || '3+',
          invulnerableSave: dsStats?.invulnerableSave || undefined,
          leadership: dsStats?.leadership || '6+',
          objectiveControl: dsStats?.objectiveControl || 1,
        },
        modelCount: pu.modelCount || (catalogUnit.modelComposition || []).reduce((acc: number, m: any) => acc + (m.count || 1), 0),
        weapons: (ds as any)?.weapons?.map((w: any) => ({
          name: w.weapon?.name || 'Default Weapon',
          type: (w.weapon?.range && w.weapon.range.toLowerCase() === 'melee') ? 'Melee' : 'Ranged',
          range: w.weapon?.range || '24"',
          attacks: w.weapon?.attacks || '2',
          skill: w.weapon?.skill || '3+',
          strength: w.weapon?.strength || 4,
          armorPenetration: w.weapon?.armorPenetration || 0,
          damage: w.weapon?.damage || '1',
          keywords: w.weapon?.keywords || [],
        })) || [],
        abilities: (ds as any)?.abilities?.map((a: any) => ({
          id: a.id,
          name: a.name,
          source: a.name.toLowerCase() === 'leader' ? 'Leader' : 'Bodyguard',
          description: a.description || '',
        })) || [],
      };
    });

    // Pair attached leaders into their bodyguard units
    const compositeUnits: any[] = [];
    const consumedLeaderIds = new Set<string>();
    const leaderByBodyguard = new Map<string, any>();

    for (const u of baseDisplayUnits) {
      if (u.attachedToInstanceId) {
        leaderByBodyguard.set(u.attachedToInstanceId, u);
        consumedLeaderIds.add(u.instanceId);
      }
    }

    for (const u of baseDisplayUnits) {
      if (consumedLeaderIds.has(u.instanceId)) continue;

      const attachedLeader = leaderByBodyguard.get(u.instanceId);
      if (attachedLeader) {
        compositeUnits.push({
          instanceId: u.instanceId,
          isComposite: true,
          displayName: `${attachedLeader.name} + ${u.name}`,
          leaderName: attachedLeader.enhancement
            ? `${attachedLeader.name} [★ ${attachedLeader.enhancement.name}]`
            : attachedLeader.name,
          bodyguardName: u.name,
          role: u.role,
          totalPoints: u.points + attachedLeader.points,
          totalModels: u.modelCount + attachedLeader.modelCount,
          keywords: Array.from(new Set([...u.keywords, ...attachedLeader.keywords])),
          stats: {
            movement: u.stats.movement,
            toughness: u.stats.toughness, // Bodyguard defensive toughness
            leaderToughness: attachedLeader.stats.toughness,
            save: u.stats.save,
            invulnerableSave: attachedLeader.stats.invulnerableSave || u.stats.invulnerableSave,
            leadership: u.stats.leadership,
            objectiveControl: u.stats.objectiveControl,
          },
          weapons: [
            ...attachedLeader.weapons.map((w: any) => ({ ...w, origin: 'Leader', displayName: `[Leader] ${w.name}` })),
            ...u.weapons.map((w: any) => ({ ...w, origin: 'Bodyguard', displayName: `[Bodyguard] ${w.name}` })),
          ],
          abilities: [
            ...attachedLeader.abilities.map((a: any) => ({ ...a, source: 'Leader' })),
            ...u.abilities.map((a: any) => ({ ...a, source: 'Bodyguard' })),
          ],
        });
      } else {
        compositeUnits.push({
          instanceId: u.instanceId,
          isComposite: false,
          displayName: u.name,
          bodyguardName: u.name,
          role: u.role,
          totalPoints: u.points,
          totalModels: u.modelCount,
          keywords: u.keywords,
          stats: u.stats,
          weapons: u.weapons.map((w: any) => ({ ...w, origin: 'Unit', displayName: w.name })),
          abilities: u.abilities,
        });
      }
    }

    return compositeUnits;
  }, [army, datasheets]);

  // Set default expanded unit
  useEffect(() => {
    if (!expandedUnitId && unitsList.length > 0) {
      setExpandedUnitId(unitsList[0]!.instanceId);
    }
  }, [unitsList, expandedUnitId]);

  // CP Management
  const handleSpendCP = (amount: number, stratName: string) => {
    if (commandPoints < amount) {
      showToast(`⚠️ Not enough CP for ${stratName} (requires ${amount} CP)`);
      return;
    }
    setCommandPoints(prev => Math.max(0, prev - amount));
    showToast(`⚡ Used ${stratName} (-${amount} CP)`);
  };

  const handleGenerateCP = (source = 'Command Phase') => {
    setCommandPoints(prev => prev + 1);
    showToast(`✓ Generated +1 CP (${source})`);
  };

  const handleAdvanceRound = () => {
    if (battleRound >= 5) {
      showToast('Battle Round 5 reached (Final Round)');
      return;
    }
    setBattleRound(prev => prev + 1);
    setActivePhase('COMMAND');
    setCommandPoints(prev => prev + 1);
    showToast(`⚔ Advanced to Battle Round ${battleRound + 1} (+1 CP granted)`);
  };

  if (loading) return <FullPageSkeleton />;

  return (
    <ThemeProvider themeKey={activeTheme}>
      {/* ── Tabletop Header ────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/"
            title="Return to Command Hub"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: '#0F172A',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94A3B8',
              textDecoration: 'none',
              fontSize: '1rem',
            }}
          >
            ←
          </Link>
          <ChapterIcon chapterKey={activeTheme} size={30} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="app-title">{army?.name || 'Battle Console'}</span>
              <span style={{
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}>
                BATTLE MODE
              </span>
            </div>
            <div className="app-subtitle">
              {army?.detachmentPrimary} • Points: {army?.rosterPayload?.totalPoints || 0} / {army?.pointsLimit || 2000}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Labeled Mode Toggle Switcher (Edit Mode <--> Battle Mode) */}
          <div style={{ display: 'flex', gap: '0.25rem', background: '#0F172A', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Link
              href={`/army/${armyId}/edit`}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#94A3B8',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderRadius: '4px',
              }}
            >
              <span>✎</span> Edit Mode
            </Link>
            <div
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                background: 'rgba(56, 189, 248, 0.25)',
                border: '1px solid #38BDF8',
                borderRadius: '4px',
                color: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>⚔</span> Battle Mode
            </div>
          </div>

          {/* Rules Audit Button */}
          <button
            type="button"
            onClick={() => setIsComplianceOpen(true)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              background: 'rgba(200, 157, 60, 0.12)',
              border: '1px solid #C89D3C',
              color: '#C89D3C',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>⚖️</span> Audit
          </button>

          {/* Theme Selector */}
          <FactionSelector
            currentTheme={activeTheme}
            onThemeChange={setActiveTheme}
          />
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          padding: '0.75rem 1.25rem',
          background: '#0F172A',
          border: '1px solid #38BDF8',
          borderRadius: '6px',
          color: '#F8FAFC',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease',
        }}>
          {notification}
        </div>
      )}

      {/* ── Main Battle Console ───────────────────────────────────────────── */}
      <main className="app-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem 1rem' }}>
        {/* ── BATTLE HUD: Round & CP Bar ──────────────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 28, 42, 0.9) 100%)',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          marginBottom: '1rem',
        }}>
          {/* Battle Round Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Battle Round</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'var(--font-display)' }}>
                Round {battleRound} / 5
              </div>
            </div>

            <button
              onClick={handleAdvanceRound}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38BDF8',
                borderRadius: '4px',
                color: '#38BDF8',
                cursor: 'pointer',
              }}
            >
              + Next Round (+1 CP)
            </button>
          </div>

          {/* Command Points Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Command Points</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#C89D3C', fontFamily: 'var(--font-display)' }}>
                {commandPoints} CP
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setCommandPoints(prev => Math.max(0, prev - 1))}
                style={{
                  width: 32,
                  height: 32,
                  fontSize: '1rem',
                  fontWeight: 800,
                  background: '#0F172A',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                -
              </button>
              <button
                onClick={() => setCommandPoints(prev => prev + 1)}
                style={{
                  width: 32,
                  height: 32,
                  fontSize: '1rem',
                  fontWeight: 800,
                  background: 'rgba(200, 157, 60, 0.2)',
                  border: '1px solid #C89D3C',
                  borderRadius: '4px',
                  color: '#C89D3C',
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* ── INTERACTIVE PHASE SELECTOR BAR ──────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.5rem',
          background: '#0B111A',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1.25rem',
          overflowX: 'auto',
        }}>
          {[
            { phase: 'COMMAND' as BattlePhase, label: 'Command Phase', icon: '📜' },
            { phase: 'MOVEMENT' as BattlePhase, label: 'Movement Phase', icon: '🏃' },
            { phase: 'SHOOTING' as BattlePhase, label: 'Shooting Phase', icon: '🎯' },
            { phase: 'CHARGE' as BattlePhase, label: 'Charge Phase', icon: '⚡' },
            { phase: 'FIGHT' as BattlePhase, label: 'Fight Phase', icon: '⚔' },
          ].map(item => {
            const isActive = activePhase === item.phase;
            return (
              <button
                key={item.phase}
                onClick={() => setActivePhase(item.phase)}
                style={{
                  flex: '1 1 140px',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isActive ? '#38BDF8' : 'transparent',
                  background: isActive ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(15, 23, 42, 0.4)',
                  color: isActive ? '#F8FAFC' : '#94A3B8',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 0 16px rgba(56, 189, 248, 0.25)' : 'none',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Command Phase Special Action: Generate Phase CP */}
        {activePhase === 'COMMAND' && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            background: 'rgba(200, 157, 60, 0.1)',
            border: '1px solid rgba(200, 157, 60, 0.3)',
            borderRadius: '6px',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: '0.8rem', color: '#E2E8F0' }}>
              <strong style={{ color: '#C89D3C' }}>Command Phase Active:</strong> Resolve Battle-shock tests, score primary objectives, and gather Command Points.
            </div>
            <button
              onClick={() => handleGenerateCP('Command Phase')}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #C89D3C 0%, #D4A843 100%)',
                border: 'none',
                borderRadius: '4px',
                color: '#070B12',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ Generate Command Phase CP (+1 CP)
            </button>
          </div>
        )}

        {/* ── FORCE ORG SINGLE-ACCORDION (ONE EXPANDED AT A TIME) ───────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {unitsList.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', background: '#0F172A', borderRadius: '8px' }}>
              No units in this battle force. <Link href={`/army/${armyId}/edit`} style={{ color: '#C89D3C', fontWeight: 700 }}>Go to Edit Mode →</Link>
            </div>
          ) : (
            unitsList.map(unit => {
              const isExpanded = expandedUnitId === unit.instanceId;

              // Filter weapons based on active phase
              const phaseWeapons = unit.weapons.filter((w: any) => {
                if (activePhase === 'SHOOTING') return w.type === 'Ranged';
                if (activePhase === 'FIGHT') return w.type === 'Melee';
                return false; // Command, Movement, Charge hide weapons per specification
              });

              // Filter stratagems matching unit keywords AND active phase (or requiredKeywords: [])
              const eligibleStratagems = CORE_STRATAGEMS.filter(strat => {
                // Phase match
                if (strat.phase !== 'ANY' && strat.phase !== activePhase) return false;
                // Keyword match: if no keyword required, it is always displayed!
                if (!strat.requiredKeywords || strat.requiredKeywords.length === 0) return true;
                return strat.requiredKeywords.some(rk => unit.keywords.includes(rk.toUpperCase()));
              });

              return (
                <div
                  key={unit.instanceId}
                  style={{
                    background: 'rgba(15, 20, 28, 0.95)',
                    border: isExpanded ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: isExpanded ? '0 4px 24px rgba(56, 189, 248, 0.15)' : 'none',
                    transition: 'border-color 150ms ease',
                  }}
                >
                  {/* Collapsed Header Bar */}
                  <div
                    onClick={() => setExpandedUnitId(isExpanded ? null : unit.instanceId)}
                    style={{
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>
                        {unit.isComposite ? '⚔' : unit.role === 'CHARACTER' ? '⚔' : unit.role === 'VEHICLE' ? '🔧' : '🛡'}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F8FAFC' }}>
                          {unit.displayName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                          {unit.role} • {unit.totalModels} models • {unit.totalPoints} pts
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8' }}>
                        {isExpanded ? '▲ Collapse' : '▼ Expand'}
                      </span>
                    </div>
                  </div>

                  {/* ── EXPANDED UNIT CARD: PHASE-ADAPTIVE DISPLAY (NO HEALTH BARS) ── */}
                  {isExpanded && (
                    <div style={{
                      padding: '1.25rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(0, 0, 0, 0.25)',
                    }}>
                      {/* Phase-Specific Statline */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                          Active {activePhase} Statline:
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {/* Command Phase: OC & Ld */}
                          {activePhase === 'COMMAND' && (
                            <>
                              <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>OC (Control)</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F8FAFC' }}>{unit.stats.objectiveControl}</div>
                              </div>
                              <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Leadership (Ld)</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F8FAFC' }}>{unit.stats.leadership}</div>
                              </div>
                            </>
                          )}

                          {/* Movement & Charge Phases: M */}
                          {(activePhase === 'MOVEMENT' || activePhase === 'CHARGE') && (
                            <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Movement (M)</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F8FAFC' }}>{unit.stats.movement}</div>
                            </div>
                          )}

                          {/* Shooting & Fight Phases: T & Sv */}
                          {(activePhase === 'SHOOTING' || activePhase === 'FIGHT') && (
                            <>
                              <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Toughness (T)</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F8FAFC' }}>T{unit.stats.toughness}</div>
                              </div>
                              <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Armor Save (Sv)</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F8FAFC' }}>{unit.stats.save}</div>
                              </div>
                              {unit.stats.invulnerableSave && (
                                <div style={{ padding: '0.5rem 1rem', background: '#0F172A', border: '1px solid #38BDF8', borderRadius: '6px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#38BDF8' }}>Invulnerable</div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38BDF8' }}>{unit.stats.invulnerableSave}</div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Phase-Specific Weapons (Shooting = Ranged only, Fight = Melee only, Others = None) */}
                      {phaseWeapons.length > 0 && (
                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                            {activePhase === 'SHOOTING' ? '🎯 Ranged Weapons' : '⚔ Melee Weapons'}:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {phaseWeapons.map((w: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '0.6rem 0.85rem',
                                  background: '#0F172A',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.85rem' }}>{w.displayName}</span>
                                  {w.keywords && w.keywords.length > 0 && (
                                    <div style={{ fontSize: '0.65rem', color: '#C89D3C', marginTop: '0.1rem' }}>
                                      {w.keywords.join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#CBD5E1', display: 'flex', gap: '0.85rem' }}>
                                  <span>Range: <strong>{w.range}</strong></span>
                                  <span>A: <strong>{w.attacks}</strong></span>
                                  <span>{w.type === 'Ranged' ? 'BS' : 'WS'}: <strong>{w.skill}</strong></span>
                                  <span>S: <strong>{w.strength}</strong></span>
                                  <span>AP: <strong>{w.armorPenetration}</strong></span>
                                  <span>D: <strong>{w.damage}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Phase-Specific Abilities & CP-Granting Actions */}
                      {unit.abilities && unit.abilities.length > 0 && (
                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                            Unit Abilities & Rules:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {unit.abilities.map((ab: any, idx: number) => {
                              const desc = ab.description || '';
                              const text = `${ab.name} ${desc}`.toLowerCase();
                              const grantsCP = text.includes('cp') || text.includes('command point');

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    padding: '0.6rem 0.85rem',
                                    background: '#0F172A',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#F8FAFC' }}>
                                      {ab.source === 'Leader' ? '★ [Leader] ' : ''}{ab.name}
                                    </strong>
                                    {grantsCP && (
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateCP(ab.name)}
                                        style={{
                                          padding: '0.2rem 0.6rem',
                                          fontSize: '0.7rem',
                                          fontWeight: 800,
                                          background: 'rgba(200, 157, 60, 0.2)',
                                          border: '1px solid #C89D3C',
                                          borderRadius: '4px',
                                          color: '#C89D3C',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        ⚡ Generate CP
                                      </button>
                                    )}
                                  </div>
                                  {desc && (
                                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem', lineHeight: 1.3 }}>
                                      {desc}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* In-Card Stratagems (Matching unit keywords and active phase) */}
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#C89D3C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                          ⚡ Legal {activePhase} Stratagems ({eligibleStratagems.length}):
                        </div>
                        {eligibleStratagems.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                            No specific Stratagems available for this unit in the {activePhase} phase.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                            {eligibleStratagems.map(strat => (
                              <div
                                key={strat.id}
                                style={{
                                  padding: '0.65rem 0.85rem',
                                  background: '#0B111A',
                                  border: '1px solid rgba(200, 157, 60, 0.25)',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#F8FAFC' }}>{strat.name}</strong>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#C89D3C' }}>{strat.cpCost} CP</span>
                                  </div>
                                  <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: '0 0 0.5rem 0', lineHeight: 1.3 }}>
                                    {strat.description}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSpendCP(strat.cpCost, strat.name)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: commandPoints >= strat.cpCost ? 'rgba(200, 157, 60, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid',
                                    borderColor: commandPoints >= strat.cpCost ? '#C89D3C' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    color: commandPoints >= strat.cpCost ? '#F8FAFC' : '#64748B',
                                    cursor: commandPoints >= strat.cpCost ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  {commandPoints >= strat.cpCost ? `Use Stratagem (-${strat.cpCost} CP)` : `Requires ${strat.cpCost} CP`}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Rules Audit Modal */}
      <ComplianceDashboard
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        rosterId={armyId}
        armyName={army?.name || 'Battle Force'}
        pointsLimit={army?.pointsLimit || 2000}
        currentPoints={army?.rosterPayload?.totalPoints || 0}
        dpLimit={army?.detachmentPointsLimit || 3}
        currentDp={army?.rosterPayload?.detachmentPointsUsed || 0}
      />
    </ThemeProvider>
  );
}
