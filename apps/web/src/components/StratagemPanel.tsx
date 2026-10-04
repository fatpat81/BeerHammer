// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Stratagem Panel Component (§6.2)
// Phase-filtered stratagem directory for the Tabletop Console
// ─────────────────────────────────────────────────────────────────────────────

'use client';

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { fetchStratagems } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { InlineError } from '@/components/ErrorBoundary';
import type { BattlePhase, Stratagem } from '@forceorg/types';

const PHASES: { key: BattlePhase; label: string; icon: string }[] = [
  { key: 'ANY', label: 'All', icon: '⚡' },
  { key: 'COMMAND', label: 'Command', icon: '📜' },
  { key: 'MOVEMENT', label: 'Movement', icon: '🏃' },
  { key: 'SHOOTING', label: 'Shooting', icon: '🎯' },
  { key: 'CHARGE', label: 'Charge', icon: '⚔️' },
  { key: 'FIGHT', label: 'Fight', icon: '🗡️' },
];

export interface StratagemData {
  id: string;
  name: string;
  cpCost: number;
  phase: BattlePhase;
  category: 'CORE' | 'DETACHMENT';
  description: string;
  requiredKeywords: string[];
}

// Built-in core stratagems for demo / fallback
const CORE_STRATAGEMS: StratagemData[] = [
  { id: 's1', name: 'Command Re-roll', cpCost: 1, phase: 'ANY', category: 'CORE', description: 'Re-roll one Hit roll, Wound roll, Damage roll, saving throw, Advance roll, Charge roll, Desperate Escape test, or Hazard test.', requiredKeywords: [] },
  { id: 's2', name: 'Counter-Offensive', cpCost: 2, phase: 'FIGHT', category: 'CORE', description: 'Interrupt the combat sequence to fight with one eligible unit.', requiredKeywords: [] },
  { id: 's3', name: 'Rapid Ingress', cpCost: 1, phase: 'MOVEMENT', category: 'CORE', description: 'Unit arrives from Reserves during opponent\'s turn.', requiredKeywords: ['DEEP STRIKE'] },
  { id: 's4', name: 'Heroic Intervention', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Counter-charge after enemy completes a charge within 6".', requiredKeywords: ['CHARACTER', 'VEHICLE', 'WALKER'] },
  { id: 's5', name: 'Smokescreen', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Unit gains Benefit of Cover and Stealth until end of phase.', requiredKeywords: ['SMOKE'] },
  { id: 's6', name: 'Tank Shock', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Roll dice equal to vehicle toughness, mortal wounds on 5+.', requiredKeywords: ['VEHICLE'] },
  { id: 's7', name: 'Go to Ground', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Unit gains Benefit of Cover and 6+ invulnerable save.', requiredKeywords: ['INFANTRY'] },
];

export interface StratagemPanelProps {
  unitKeywords: string[];
  isOpen: boolean;
  detachmentId?: string;
  detachmentStratagems?: StratagemData[];
}

export const StratagemPanel: React.FC<StratagemPanelProps> = ({
  unitKeywords,
  isOpen,
  detachmentId,
  detachmentStratagems = [],
}) => {
  const [activePhase, setActivePhase] = useState<BattlePhase>('ANY');
  const [apiStratagems, setApiStratagems] = useState<StratagemData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [source, setSource] = useState<'api' | 'default'>('default');
  const [error, setError] = useState<string | null>(null);

  const loadStratagems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStratagems({ detachmentId });
      if (Array.isArray(data) && data.length > 0) {
        const mapped: StratagemData[] = data.map(s => ({
          id: s.id,
          name: s.name,
          cpCost: s.cpCost,
          phase: s.phase,
          category: s.category,
          description: s.description,
          requiredKeywords: s.requiredKeywords || [],
        }));
        setApiStratagems(mapped);
        setSource('api');
      } else {
        setApiStratagems(CORE_STRATAGEMS);
        setSource('default');
      }
    } catch (err: any) {
      console.warn('[StratagemPanel] Live API unavailable, using standard rules:', err?.message);
      setApiStratagems(CORE_STRATAGEMS);
      setSource('default');
      setError(err?.message || 'Could not fetch stratagems');
    } finally {
      setIsLoading(false);
    }
  }, [detachmentId]);

  useEffect(() => {
    if (isOpen) {
      loadStratagems();
    }
  }, [isOpen, loadStratagems]);

  const allStratagems = useMemo(() => {
    const base = apiStratagems.length > 0 ? apiStratagems : CORE_STRATAGEMS;
    if (detachmentStratagems.length === 0) return base;
    const existingIds = new Set(base.map(s => s.id));
    const uniqueDetachment = detachmentStratagems.filter(s => !existingIds.has(s.id));
    return [...base, ...uniqueDetachment];
  }, [apiStratagems, detachmentStratagems]);

  const filteredStratagems = useMemo(() => {
    const upperKeywords = new Set(unitKeywords.map(k => k.toUpperCase()));

    return allStratagems.filter(strat => {
      // Phase filter
      if (activePhase !== 'ANY' && strat.phase !== 'ANY' && strat.phase !== activePhase) return false;

      // Keyword eligibility
      if (strat.requiredKeywords.length > 0) {
        const eligible = strat.requiredKeywords.some(rk => upperKeywords.has(rk.toUpperCase()));
        if (!eligible) return false;
      }

      return true;
    });
  }, [allStratagems, activePhase, unitKeywords]);

  if (!isOpen) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="panel-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Stratagem Directory</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm, 4px)',
            fontWeight: 600,
            background: source === 'api' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: source === 'api' ? '#4ADE80' : '#FBBF24',
            border: source === 'api' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            {source === 'api' ? '● Live Stratagems' : '○ Core Rules'}
          </span>
          <button
            onClick={loadStratagems}
            disabled={isLoading}
            title="Refresh stratagems from API"
            style={{
              background: 'transparent',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm, 4px)',
              padding: '2px 6px',
              fontSize: '0.65rem',
              cursor: isLoading ? 'wait' : 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {isLoading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Error notice if live API is unavailable */}
      {error && source === 'default' && (
        <div style={{ marginBottom: '0.75rem' }}>
          <InlineError
            message={`Notice: ${error}. Showing core 11th Edition rules.`}
            onRetry={loadStratagems}
          />
        </div>
      )}

      {/* Phase Filter Dock */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '0.75rem',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
      }}>
        {PHASES.map(phase => (
          <button
            key={phase.key}
            onClick={() => setActivePhase(phase.key)}
            style={{
              padding: '0.375rem 0.625rem',
              borderRadius: 'var(--radius-md, 6px)',
              border: activePhase === phase.key
                ? '1px solid var(--c-glow, #38bdf8)'
                : '1px solid var(--surface-border, #334155)',
              background: activePhase === phase.key
                ? 'rgba(56, 189, 248, 0.12)'
                : 'transparent',
              color: activePhase === phase.key
                ? 'var(--c-glow, #38bdf8)'
                : 'var(--text-secondary, #94a3b8)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
          >
            {phase.icon} {phase.label}
          </button>
        ))}
      </div>

      {/* Stratagem List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: '0.75rem', background: 'rgba(15, 20, 28, 0.9)', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--surface-border)' }}>
              <Skeleton width="45%" height="0.85rem" />
              <Skeleton width="85%" height="0.65rem" style={{ marginTop: '0.4rem' }} />
            </div>
          ))}
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredStratagems.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
            No stratagems available for this unit in the {activePhase} phase.
          </div>
        ) : (
          filteredStratagems.map(strat => (
            <div
              key={strat.id}
              style={{
                padding: '0.625rem',
                background: 'rgba(15, 20, 28, 0.9)',
                border: strat.category === 'DETACHMENT'
                  ? '1px solid rgba(200, 157, 60, 0.3)'
                  : '1px solid var(--surface-border, #334155)',
                borderRadius: 'var(--radius-md, 6px)',
                transition: 'all 150ms ease',
                cursor: 'pointer',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.25rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{strat.name}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}>
                  <span style={{
                    fontSize: '0.6rem',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: strat.category === 'CORE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(200, 157, 60, 0.15)',
                    color: strat.category === 'CORE' ? 'var(--c-glow)' : 'var(--c-trim)',
                    fontWeight: 600,
                  }}>
                    {strat.category}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: strat.cpCost <= 1 ? 'var(--c-glow)' : '#F59E0B',
                    minWidth: '28px',
                    textAlign: 'right',
                  }}>
                    {strat.cpCost} CP
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {strat.description}
              </div>
              {strat.requiredKeywords.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  marginTop: '0.375rem',
                  flexWrap: 'wrap',
                }}>
                  {strat.requiredKeywords.map(kw => (
                    <span
                      key={kw}
                      style={{
                        fontSize: '0.6rem',
                        padding: '1px 4px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        borderRadius: '2px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      )}

      {/* Summary */}
      <div style={{
        marginTop: '0.75rem',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        {filteredStratagems.length} of {allStratagems.length} stratagems available
      </div>
    </div>
  );
};
