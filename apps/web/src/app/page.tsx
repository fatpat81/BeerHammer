// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Command Nexus / My Armies Dashboard (Step 2.1 & 2.2)
// Route: /
// Lists user armies, allows creating new forces, and navigating to Console or Studio
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeProvider, ChapterIcon, ALL_FACTION_PALETTES } from '@forceorg/ui-theme';
import { useAuth } from '@/components/AuthProvider';
import LoginPage from '@/components/LoginPage';
import { FullPageSkeleton, Skeleton } from '@/components/Skeleton';
import { CreateArmyModal } from '@/components/CreateArmyModal';
import { DeleteArmyModal } from '@/components/DeleteArmyModal';
import { ComplianceDashboard } from '@/components/ComplianceDashboard';
import { FactionSelector } from '@/components/FactionSelector';
import { fetchRosters } from '@/lib/api';
import type { UserArmy } from '@forceorg/types';

// Default starter army for instant onboarding
const STARTER_DEMO_ARMY: UserArmy = {
  id: 'demo-roster-1',
  userId: 'demo-user',
  name: 'Ultramarines 1st Company Veteran Force',
  factionId: 'adeptus_astartes',
  rulesetVersionId: '11.1.0-2026-Q3',
  detachmentPrimary: '1st Company Task Force',
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

export default function MyArmiesDashboard() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [activeTheme, setActiveTheme] = useState('ultramarines');
  const [armies, setArmies] = useState<UserArmy[]>([]);
  const [loadingArmies, setLoadingArmies] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingArmy, setDeletingArmy] = useState<UserArmy | null>(null);
  const [auditingArmy, setAuditingArmy] = useState<UserArmy | null>(null);

  // ── Load user armies ─────────────────────────────────────────────────────
  const loadArmies = useCallback(async () => {
    setLoadingArmies(true);
    try {
      const data = await fetchRosters();
      if (Array.isArray(data) && data.length > 0) {
        setArmies(data);
      } else {
        // Provide starter army so the user is never left with a blank screen
        setArmies([STARTER_DEMO_ARMY]);
      }
    } catch (err) {
      console.warn('[MyArmies] Live fetch failed, using starter template:', err);
      setArmies([STARTER_DEMO_ARMY]);
    } finally {
      setLoadingArmies(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadArmies();
    }
  }, [user, loadArmies]);

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  if (authLoading) return <FullPageSkeleton />;
  if (!user) return <LoginPage />;

  const handleArmyCreated = (newArmy: UserArmy) => {
    setArmies(prev => [newArmy, ...prev]);
  };

  const handleArmyDeleted = (armyId: string) => {
    setArmies(prev => prev.filter(a => a.id !== armyId));
  };

  return (
    <ThemeProvider themeKey={activeTheme}>
      {/* ── Dashboard Header ────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ChapterIcon chapterKey={activeTheme} size={32} />
          <div>
            <span className="app-title">ForceOrg-40k</span>
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
              My Battle Forces
            </h1>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: 540,
              lineHeight: 1.4,
            }}>
              Construct tournament-compliant 11th Edition rosters, configure wargear with instant rule AST validation, and command your units in real-time with wound tracking and stratagem cards.
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

        {/* ── Armies Grid ──────────────────────────────────────────────────── */}
        {loadingArmies ? (
          <div className="army-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="army-card" style={{ padding: '1.25rem' }}>
                <Skeleton width="60%" height="1.2rem" />
                <Skeleton width="40%" height="0.8rem" style={{ marginTop: '0.5rem' }} />
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <Skeleton width="100%" height="45px" variant="rect" />
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <Skeleton width="50%" height="32px" variant="rect" />
                  <Skeleton width="50%" height="32px" variant="rect" />
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
                      <span>⚔</span> Console
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
                      <span>⚖️</span> Audit
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
