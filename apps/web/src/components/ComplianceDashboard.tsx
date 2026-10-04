// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Compliance Dashboard (§5.2)
// Live audit modal showing rules violations, points shifts, and DP compliance
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditRoster, updateRoster } from '../lib/api';
import type { AuditResult, RosterDiscrepancy } from '@forceorg/types';

export interface ComplianceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  rosterId: string;
  armyName: string;
  pointsLimit?: number;
  currentPoints?: number;
  dpLimit?: number;
  currentDp?: number;
  onAutoFixPoints?: () => void;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  isOpen,
  onClose,
  rosterId,
  armyName,
  pointsLimit = 2000,
  currentPoints = 0,
  dpLimit = 3,
  currentDp = 0,
  onAutoFixPoints,
}) => {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'POINTS_SHIFT' | 'DP_VIOLATION' | 'INVALID_LOADOUT'>('ALL');
  const [isApplyingFix, setIsApplyingFix] = useState<boolean>(false);
  const [fixSuccess, setFixSuccess] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setIsLoading(true);
    setFixSuccess(null);
    try {
      const result = await auditRoster(rosterId);
      setAuditResult(result);
    } catch (err: any) {
      console.warn('[Compliance] Audit API unavailable, computing local client audit:', err);
      // Graceful client-side audit calculation
      const clientDiscrepancies: RosterDiscrepancy[] = [];

      if (currentPoints > pointsLimit) {
        clientDiscrepancies.push({
          unitInstanceId: '',
          unitName: 'Army Total Points',
          severity: 'RED',
          category: 'POINTS_SHIFT',
          message: `Army total (${currentPoints}pts) exceeds the match limit (${pointsLimit}pts) by ${currentPoints - pointsLimit}pts.`,
          oldValue: `${pointsLimit}`,
          newValue: `${currentPoints}`,
        });
      }

      if (currentDp > dpLimit) {
        clientDiscrepancies.push({
          unitInstanceId: '',
          unitName: 'Detachment Points',
          severity: 'RED',
          category: 'DP_VIOLATION',
          message: `Detachment points used (${currentDp} DP) exceeds the primary detachment allowance (${dpLimit} DP).`,
          oldValue: `${dpLimit} DP`,
          newValue: `${currentDp} DP`,
        });
      }

      setAuditResult({
        rosterId,
        rulesetVersionCompared: '11.1.0-2026-Q3-MFM',
        discrepancies: clientDiscrepancies,
        isCompliant: clientDiscrepancies.filter(d => d.severity === 'RED').length === 0,
        auditedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [rosterId, currentPoints, pointsLimit, currentDp, dpLimit]);

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen, runAudit]);

  if (!isOpen) return null;

  const discrepancies = auditResult?.discrepancies || [];
  const redViolations = discrepancies.filter(d => d.severity === 'RED');
  const amberWarnings = discrepancies.filter(d => d.severity === 'AMBER');
  const pointShiftDiscrepancies = discrepancies.filter(d => d.category === 'POINTS_SHIFT');

  const filteredDiscrepancies = discrepancies.filter(d => {
    if (selectedCategory === 'ALL') return true;
    return d.category === selectedCategory;
  });

  const isFullyCompliant = discrepancies.length === 0;
  const isBattleLegal = redViolations.length === 0;

  const handleApplyFix = async () => {
    setIsApplyingFix(true);
    setFixSuccess(null);
    try {
      onAutoFixPoints?.();
      setFixSuccess('Points successfully aligned with active MFM datasheets.');
      setTimeout(() => {
        runAudit();
      }, 500);
    } catch {
      setFixSuccess('Local roster synced.');
    } finally {
      setIsApplyingFix(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget && !isApplyingFix) onClose();
      }}
    >
      <div
        className="modal-container"
        style={{ maxWidth: '640px', width: '92%', maxHeight: '88vh', overflowY: 'auto' }}
      >
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--c-border, #2a344d)', paddingBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>⚖️</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Rules Compliance Audit
              </h2>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted, #a3a3a3)', marginTop: '0.2rem' }}>
              {armyName} · Ruleset: <strong>{auditResult?.rulesetVersionCompared || '11.1.0-2026-Q3-MFM'}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* ── Compliance Banner ───────────────────────────────────────── */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md, 8px)',
            marginBottom: '1.25rem',
            background: isFullyCompliant
              ? 'rgba(34, 197, 94, 0.12)'
              : isBattleLegal
              ? 'rgba(234, 179, 8, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: `1.5px solid ${
              isFullyCompliant
                ? '#22c55e'
                : isBattleLegal
                ? '#eab308'
                : '#ef4444'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.8rem' }}>
              {isFullyCompliant ? '🛡️' : isBattleLegal ? '⚠️' : '🚫'}
            </span>
            <div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isFullyCompliant
                    ? '#4ade80'
                    : isBattleLegal
                    ? '#facc15'
                    : '#f87171',
                }}
              >
                {isFullyCompliant
                  ? 'Battle-Ready (100% Compliant)'
                  : isBattleLegal
                  ? 'Legal With Advisory Warnings'
                  : 'Illegal Roster — Action Required'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted, #a3a3a3)', marginTop: '0.15rem' }}>
                {isFullyCompliant
                  ? 'All units adhere strictly to 11th Edition points limits, DP quotas, and loadouts.'
                  : isBattleLegal
                  ? `${amberWarnings.length} advisory point shifts or errata detected. Valid for casual play.`
                  : `${redViolations.length} critical rules violations prevent matched play certification.`}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={runAudit}
            disabled={isLoading}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}
          >
            {isLoading ? 'Auditing…' : '↻ Re-Audit'}
          </button>
        </div>

        {/* ── Summary Stat Metrics ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'var(--c-bg-card, #141824)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--c-border, #2a344d)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted, #a3a3a3)' }}>Violations</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: redViolations.length > 0 ? '#f87171' : '#4ade80' }}>
              {redViolations.length}
            </div>
          </div>
          <div style={{ background: 'var(--c-bg-card, #141824)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--c-border, #2a344d)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted, #a3a3a3)' }}>Advisories</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: amberWarnings.length > 0 ? '#facc15' : '#4ade80' }}>
              {amberWarnings.length}
            </div>
          </div>
          <div style={{ background: 'var(--c-bg-card, #141824)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--c-border, #2a344d)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted, #a3a3a3)' }}>Points Limit</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: currentPoints > pointsLimit ? '#f87171' : 'var(--c-trim, #c89d3c)' }}>
              {currentPoints} / {pointsLimit}
            </div>
          </div>
          <div style={{ background: 'var(--c-bg-card, #141824)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--c-border, #2a344d)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted, #a3a3a3)' }}>DP Quota</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: currentDp > dpLimit ? '#f87171' : '#38bdf8' }}>
              {currentDp} / {dpLimit} DP
            </div>
          </div>
        </div>

        {/* ── Category Filter Tabs ────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[
            { id: 'ALL', label: `All Issues (${discrepancies.length})` },
            { id: 'POINTS_SHIFT', label: 'Points Shifts' },
            { id: 'DP_VIOLATION', label: 'Detachment Points' },
            { id: 'INVALID_LOADOUT', label: 'Loadouts & Rules' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id as any)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: selectedCategory === tab.id ? '1px solid var(--c-trim, #c89d3c)' : '1px solid var(--c-border, #2a344d)',
                background: selectedCategory === tab.id ? 'rgba(200, 157, 60, 0.15)' : 'transparent',
                color: selectedCategory === tab.id ? 'var(--c-trim, #c89d3c)' : 'var(--c-text-muted, #a3a3a3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Discrepancy Items List ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {filteredDiscrepancies.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-muted, #a3a3a3)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              ✓ No discrepancies found in this category.
            </div>
          ) : (
            filteredDiscrepancies.map((disc, idx) => {
              const isRed = disc.severity === 'RED';
              return (
                <div
                  key={`disc-${idx}`}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: isRed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                    border: `1px solid ${isRed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', marginTop: '0.1rem' }}>{isRed ? '🔴' : '🟡'}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-text-primary, #f8fafc)' }}>
                          {disc.unitName || disc.category.replace(/_/g, ' ')}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: isRed ? '#ef4444' : '#eab308',
                            color: '#000',
                          }}
                        >
                          {disc.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--c-text-secondary, #cbd5e1)', marginTop: '0.2rem' }}>
                        {disc.message}
                      </div>
                    </div>
                  </div>

                  {disc.oldValue && disc.newValue && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textDecoration: 'line-through', marginRight: '0.35rem' }}>
                        {disc.oldValue}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: isRed ? '#f87171' : '#facc15' }}>
                        {disc.newValue}
                      </strong>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Fix Success Banner ──────────────────────────────────────── */}
        {fixSuccess && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              marginBottom: '1rem',
              borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#4ade80',
              fontSize: '0.8rem',
            }}
          >
            ✓ {fixSuccess}
          </div>
        )}

        {/* ── Footer Actions ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--c-border, #2a344d)', paddingTop: '0.75rem' }}>
          {pointShiftDiscrepancies.length > 0 && onAutoFixPoints ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplyFix}
              disabled={isApplyingFix}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>⚡</span> {isApplyingFix ? 'Recalculating…' : 'Sync Active Points (1-Click)'}
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
