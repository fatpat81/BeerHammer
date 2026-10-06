// ─────────────────────────────────────────────────────────────────────────────
// BeerHammer — Command Nexus / Dashboard (Step 2.1 & 2.2)
// Route: /
// Features: Matched Play Rosters (500/1000/2000 pts) + Dedicated Combat Patrol Tab (Wahapedia)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeProvider, ChapterIcon } from '@forceorg/ui-theme';
import { useAuth } from '@/components/AuthProvider';
import LoginPage from '@/components/LoginPage';
import { FullPageSkeleton, Skeleton } from '@/components/Skeleton';
import { CreateArmyModal } from '@/components/CreateArmyModal';
import { DeleteArmyModal } from '@/components/DeleteArmyModal';
import { ComplianceDashboard } from '@/components/ComplianceDashboard';
import { FactionSelector } from '@/components/FactionSelector';
import { fetchRosters, createRoster } from '@/lib/api';
import type { UserArmy } from '@forceorg/types';

// Default starter army for instant onboarding
const STARTER_DEMO_ARMY: UserArmy = {
  id: 'demo-roster-1',
  userId: 'demo-user',
  name: 'Ultramarines 1st Company Veteran Force',
  factionId: 'imperium-space-marines',
  rulesetVersionId: '11.1.0-2026-Q3',
  detachmentPrimary: 'Gladius Task Force',
  detachmentSecondary: null,
  pointsLimit: 2000,
  detachmentPointsLimit: 3,
  factionThemeOverride: 'ultramarines',
  rosterPayload: {
    units: [
      {
        instanceId: 'inst_term_cap',
        datasheetId: 'ds-captain-terminator',
        datasheetName: 'Captain in Terminator Armour',
        modelCount: 1,
        wargearSelections: [],
        pointsCost: 95,
      },
      {
        instanceId: 'inst_term_sq',
        datasheetId: 'ds-terminator-squad',
        datasheetName: 'Terminator Squad',
        modelCount: 5,
        wargearSelections: [],
        pointsCost: 185,
      },
      {
        instanceId: 'inst_intercessors',
        datasheetId: 'ds-intercessor-squad',
        datasheetName: 'Intercessor Squad',
        modelCount: 5,
        wargearSelections: [],
        pointsCost: 75,
      },
    ],
    totalPoints: 355,
    detachmentPointsUsed: 0,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface CombatPatrolData {
  id: string;
  factionId: string;
  factionName: string;
  patrolName: string;
  grandAlliance: string;
  description: string;
  patrolRule: { name: string; description: string };
  enhancements: { name: string; leader: string; description: string }[];
  secondaryObjectives: { name: string; description: string }[];
  units: {
    name: string;
    role: string;
    modelCount: number;
    stats: any;
    weapons: any[];
    abilities: string[];
  }[];
}

export default function MyArmiesDashboard() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [armies, setArmies] = useState<UserArmy[]>([]);
  const [loadingArmies, setLoadingArmies] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingArmy, setDeletingArmy] = useState<UserArmy | null>(null);
  const [auditingArmy, setAuditingArmy] = useState<UserArmy | null>(null);

  // Tab State: Matched Play vs Combat Patrol (Q10=B)
  const [activeMainTab, setActiveMainTab] = useState<'matched_play' | 'combat_patrol'>('matched_play');

  // Combat Patrols Data
  const [combatPatrols, setCombatPatrols] = useState<CombatPatrolData[]>([]);
  const [loadingPatrols, setLoadingPatrols] = useState(false);
  const [patrolAllianceFilter, setPatrolAllianceFilter] = useState<string>('ALL');
  const [deployingPatrolId, setDeployingPatrolId] = useState<string | null>(null);

  // ── Load user armies ─────────────────────────────────────────────────────
  const loadArmies = useCallback(async () => {
    setLoadingArmies(true);
    try {
      const data = await fetchRosters();
      if (Array.isArray(data) && data.length > 0) {
        setArmies(data);
      } else {
        setArmies([STARTER_DEMO_ARMY]);
      }
    } catch (err) {
      console.warn('[MyArmies] Live fetch failed, using starter template:', err);
      setArmies([STARTER_DEMO_ARMY]);
    } finally {
      setLoadingArmies(false);
    }
  }, []);

  // ── Load official Combat Patrols from Wahapedia dataset ──────────────────
  useEffect(() => {
    let mounted = true;
    async function loadPatrols() {
      setLoadingPatrols(true);
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const res = await fetch(`${basePath}/data/combat-patrol/combat-patrols.json`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setCombatPatrols(data);
        }
      } catch (err) {
        console.warn('Failed to load combat patrols:', err);
      } finally {
        if (mounted) setLoadingPatrols(false);
      }
    }
    loadPatrols();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) {
      loadArmies();
    }
  }, [user, loadArmies]);

  // Deploy official Combat Patrol to console
  const handleDeployPatrol = async (patrol: CombatPatrolData) => {
    setDeployingPatrolId(patrol.id);
    try {
      const payloadUnits = patrol.units.map((u, i) => ({
        instanceId: `cp_inst_${Date.now()}_${i}`,
        datasheetId: `cp_ds_${i}`,
        datasheetName: u.name,
        modelCount: u.modelCount,
        wargearSelections: [],
        pointsCost: 0,
        catalogUnit: {
          id: `cp_ds_${i}`,
          name: u.name,
          factionId: patrol.factionId,
          battlefieldRole: u.role,
          basePoints: 0,
          dpCost: 0,
          keywords: [patrol.factionName.toUpperCase(), u.role],
          wargearRulesRaw: '',
          modelComposition: [{ name: u.name, count: u.modelCount }],
          stats: u.stats,
          weapons: u.weapons,
          abilities: u.abilities.map((ab: string) => ({ name: ab, description: '' })),
          isLeader: u.role === 'CHARACTER',
        },
      }));

      const newArmy = await createRoster({
        name: `${patrol.factionName} — ${patrol.patrolName}`,
        factionId: patrol.factionId,
        detachmentPrimary: `Combat Patrol: ${patrol.patrolRule.name}`,
        pointsLimit: 500,
        detachmentPointsLimit: 1,
        factionThemeOverride: patrol.factionId.replace('imperium-', '').replace('chaos-', ''),
        rosterPayload: {
          units: payloadUnits,
          totalPoints: 500,
          detachmentPointsUsed: 0,
        },
      });

      setArmies(prev => [newArmy, ...prev]);
      router.push(`/army/${newArmy.id}`);
    } catch (err) {
      console.error('Failed to deploy combat patrol:', err);
    } finally {
      setDeployingPatrolId(null);
    }
  };

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  if (authLoading) return <FullPageSkeleton />;
  if (!user) return <LoginPage />;

  const handleArmyCreated = (newArmy: UserArmy) => {
    setArmies(prev => [newArmy, ...prev]);
  };

  const handleArmyDeleted = (armyId: string) => {
    setArmies(prev => prev.filter(a => a.id !== armyId));
  };

  const filteredPatrols = combatPatrols.filter(p => {
    if (patrolAllianceFilter !== 'ALL' && p.grandAlliance !== patrolAllianceFilter) return false;
    return true;
  });

  return (
    <ThemeProvider themeKey={activeTheme}>
      {/* ── Dashboard Header ────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ChapterIcon chapterKey={activeTheme} size={32} />
          <div>
            <span className="app-title">BeerHammer</span>
            <div className="app-subtitle">Command Nexus • 11th Edition</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Link
            href="/catalog"
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', textDecoration: 'none' }}
          >
            📚 Catalog
          </Link>
          <Link
            href="/changelog"
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', textDecoration: 'none' }}
          >
            📡 Changelog
          </Link>

          {/* Faction Selector */}
          <FactionSelector
            currentTheme={activeTheme}
            onThemeChange={setActiveTheme}
          />

          {/* User & Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {user.user_metadata?.callsign || user.email?.split('@')[0]}
            </span>
            <button
              onClick={() => signOut()}
              title={`Signed in as ${user.email}`}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="app-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Hero Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(15, 20, 28, 0.95) 0%, rgba(20, 28, 42, 0.85) 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(200, 157, 60, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          marginBottom: '1.5rem',
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--c-trim)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '0.4rem',
            }}>
              <span>✦</span> Force Construction & Tabletop Console
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: '0 0 0.5rem 0',
              letterSpacing: '0.02em',
            }}>
              Command Hub & Force Org
            </h1>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: 580,
              lineHeight: 1.4,
            }}>
              Construct tournament-compliant 11th Edition rosters (500 / 1000 / 2000 pts) across all 27 factions, or deploy fixed official Wahapedia Combat Patrols for immediate tabletop play.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: 'linear-gradient(135deg, var(--c-trim, #C89D3C) 0%, #D4A843 100%)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#070b12',
                fontFamily: 'var(--font-display)',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(200, 157, 60, 0.35)',
                transition: 'all 150ms ease',
              }}
            >
              <span>+</span> Assemble New Force
            </button>
          </div>
        </div>

        {/* ── Main Mode Tabs: Matched Play vs Combat Patrol (Q10=B) ────────── */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.25rem' }}>
          <button
            onClick={() => setActiveMainTab('matched_play')}
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: '6px 6px 0 0',
              border: 'none',
              borderBottom: activeMainTab === 'matched_play' ? '3px solid #C89D3C' : '3px solid transparent',
              background: activeMainTab === 'matched_play' ? 'rgba(200, 157, 60, 0.12)' : 'transparent',
              color: activeMainTab === 'matched_play' ? '#F8FAFC' : '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 150ms ease',
            }}
          >
            <span>🏆</span> Matched Play Rosters ({armies.length})
          </button>

          <button
            onClick={() => setActiveMainTab('combat_patrol')}
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: '6px 6px 0 0',
              border: 'none',
              borderBottom: activeMainTab === 'combat_patrol' ? '3px solid #38BDF8' : '3px solid transparent',
              background: activeMainTab === 'combat_patrol' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: activeMainTab === 'combat_patrol' ? '#F8FAFC' : '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 150ms ease',
            }}
          >
            <span>⚡</span> Combat Patrol Mode (Official Wahapedia)
          </button>
        </div>

        {/* ── TAB 1: Matched Play Rosters ───────────────────────────────────── */}
        {activeMainTab === 'matched_play' && (
          loadingArmies ? (
            <div className="army-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="army-card" style={{ padding: '1.25rem' }}>
                  <Skeleton width="60%" height="1.2rem" />
                  <Skeleton width="40%" height="0.8rem" style={{ marginTop: '0.5rem' }} />
                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                    <Skeleton width="100%" height="45px" variant="rect" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="army-grid">
              {armies.map(army => {
                const payload = (army.rosterPayload as any) || {};
                const units: any[] = payload.units || [];
                const totalPoints = payload.totalPoints || units.reduce((sum: number, u: any) => sum + (u.pointsCost || 0), 0);
                const theme = army.factionThemeOverride || activeTheme;
                const pointsPercent = Math.min(100, (totalPoints / army.pointsLimit) * 100);

                return (
                  <div key={army.id} className="army-card">
                    <div>
                      <div className="army-card-header">
                        <div>
                          <h2 className="army-card-title">{army.name}</h2>
                          <div className="army-card-subtitle">
                            <span>{army.detachmentPrimary}</span>
                          </div>
                        </div>
                        <div style={{ width: 34, height: 34, flexShrink: 0 }}>
                          <ChapterIcon chapterKey={theme} size={34} />
                        </div>
                      </div>

                      {/* Stats Tally */}
                      <div className="army-card-stats">
                        <div className="army-stat-item">
                          <span className="army-stat-label">Points</span>
                          <span className="army-stat-value" style={{ color: totalPoints > army.pointsLimit ? '#ef4444' : 'var(--c-trim)' }}>
                            {totalPoints} / {army.pointsLimit}
                          </span>
                        </div>
                        <div className="army-stat-item">
                          <span className="army-stat-label">Units</span>
                          <span className="army-stat-value">{units.length}</span>
                        </div>
                        <div className="army-stat-item">
                          <span className="army-stat-label">DP Cost</span>
                          <span className="army-stat-value">{payload.detachmentPointsUsed || 0} / {army.detachmentPointsLimit}</span>
                        </div>
                      </div>

                      {/* Points Progress Bar */}
                      <div style={{ width: '100%', height: 4, background: 'var(--surface-border)', borderRadius: 2, overflow: 'hidden', marginBottom: '0.75rem' }}>
                        <div
                          style={{
                            width: `${pointsPercent}%`,
                            height: '100%',
                            background: totalPoints > army.pointsLimit ? '#ef4444' : 'var(--c-glow, #38bdf8)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="army-card-actions">
                      <Link
                        href={`/army/${army.id}`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          padding: '0.45rem 0.65rem',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#38bdf8',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          transition: 'all 120ms ease',
                        }}
                      >
                        <span>⚔</span> Play Mode
                      </Link>

                      <Link
                        href={`/army/${army.id}/edit`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          padding: '0.45rem 0.65rem',
                          background: 'rgba(200, 157, 60, 0.12)',
                          border: '1px solid rgba(200, 157, 60, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--c-trim)',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          transition: 'all 120ms ease',
                        }}
                      >
                        <span>✎</span> Studio
                      </Link>

                      <button
                        type="button"
                        onClick={() => setAuditingArmy(army)}
                        title="Rules Compliance Audit"
                        style={{
                          padding: '0.45rem 0.65rem',
                          background: 'rgba(200, 157, 60, 0.08)',
                          border: '1px solid rgba(200, 157, 60, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--c-trim)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 120ms ease',
                        }}
                      >
                        <span>⚖️</span>
                      </button>

                      <button
                        onClick={() => setDeletingArmy(army)}
                        title="Disband Battle Force"
                        style={{
                          padding: '0.45rem 0.65rem',
                          background: 'transparent',
                          border: '1px solid var(--surface-border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          transition: 'all 120ms ease',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── TAB 2: Official Wahapedia Combat Patrols (Q10=B) ──────────────── */}
        {activeMainTab === 'combat_patrol' && (
          <div>
            {/* Alliance Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>Filter by Alliance:</span>
              {(['ALL', 'Imperium', 'Chaos', 'Xenos'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPatrolAllianceFilter(tab)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: patrolAllianceFilter === tab ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                    background: patrolAllianceFilter === tab ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    color: patrolAllianceFilter === tab ? '#F8FAFC' : '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {loadingPatrols ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>Loading Wahapedia Combat Patrols...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {filteredPatrols.map(patrol => (
                  <div
                    key={patrol.id}
                    style={{
                      background: 'rgba(15, 20, 28, 0.85)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {patrol.factionName} • {patrol.grandAlliance}
                          </div>
                          <h3 style={{ margin: '0.2rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                            {patrol.patrolName}
                          </h3>
                        </div>
                        <ChapterIcon chapterKey={patrol.factionId.replace('imperium-', '').replace('chaos-', '')} size={32} />
                      </div>

                      <p style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4, margin: '0 0 0.85rem 0' }}>
                        {patrol.description}
                      </p>

                      {/* Patrol Rule Box */}
                      <div style={{ padding: '0.65rem 0.75rem', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', marginBottom: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', marginBottom: '0.2rem' }}>
                          ⚡ {patrol.patrolRule.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#CBD5E1', lineHeight: 1.3 }}>
                          {patrol.patrolRule.description}
                        </div>
                      </div>

                      {/* Fixed Units Summary */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                          Patrol Force Units ({patrol.units.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {patrol.units.map((u, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                background: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '4px',
                                color: '#E2E8F0',
                              }}
                            >
                              {u.name} ({u.modelCount}x)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Deploy Button */}
                    <button
                      type="button"
                      disabled={deployingPatrolId === patrol.id}
                      onClick={() => handleDeployPatrol(patrol)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: '#070B12',
                        background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: deployingPatrolId === patrol.id ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span>⚡</span> {deployingPatrolId === patrol.id ? 'Deploying Patrol...' : 'Deploy Patrol to Play Mode'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <CreateArmyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onArmyCreated={handleArmyCreated}
      />

      <DeleteArmyModal
        isOpen={!!deletingArmy}
        army={deletingArmy}
        onClose={() => setDeletingArmy(null)}
        onDeleted={handleArmyDeleted}
      />

      {/* ── Compliance Audit Modal ─────────────────────────────────────────── */}
      <ComplianceDashboard
        isOpen={!!auditingArmy}
        onClose={() => setAuditingArmy(null)}
        rosterId={auditingArmy?.id || ''}
        armyName={auditingArmy?.name || 'Battle Force'}
        pointsLimit={auditingArmy?.pointsLimit || 2000}
        currentPoints={auditingArmy?.rosterPayload?.totalPoints || 0}
        dpLimit={auditingArmy?.detachmentPointsLimit || 3}
        currentDp={auditingArmy?.rosterPayload?.detachmentPointsUsed || 0}
      />
    </ThemeProvider>
  );
}
