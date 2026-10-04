// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Roster Audit Route (§5.2)
// POST /api/rosters/:id/audit — compares roster against live rules
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { PrismaClient } from '@forceorg/db-client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateRoster } from '@forceorg/rules-engine-11e';
import type { RosterPayload, Datasheet as DatasheetType, RosterDiscrepancy, AuditResult } from '@forceorg/types';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/rosters/:id/audit
 * Runs a full rules compliance audit against the latest ruleset version.
 *
 * Checks:
 * - Point shift validation (changes to unit/enhancement costs)
 * - Detachment Point & quota limits
 * - Loadout and errata validation
 * - Rule of Three enforcement
 */
router.post('/rosters/:id/audit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const army = await prisma.userArmy.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!army) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Roster not found.' } });
      return;
    }

    const rosterPayload = army.rosterPayload as unknown as RosterPayload;
    const discrepancies: RosterDiscrepancy[] = [];

    // Fetch current datasheets for all units in the roster
    const datasheetIds = rosterPayload.units.map(u => u.datasheetId);
    const currentDatasheets = await prisma.datasheet.findMany({
      where: { id: { in: datasheetIds } },
    });

    const datasheetLookup = new Map<string, DatasheetType>();
    for (const ds of currentDatasheets) {
      datasheetLookup.set(ds.id, ds as unknown as DatasheetType);
    }

    // ── Point Shift Detection ──────────────────────────────────────────────
    for (const unit of rosterPayload.units) {
      const currentDs = datasheetLookup.get(unit.datasheetId);
      if (!currentDs) {
        discrepancies.push({
          unitInstanceId: unit.instanceId,
          unitName: unit.datasheetName,
          severity: 'RED',
          category: 'INVALID_LOADOUT',
          message: `Datasheet "${unit.datasheetName}" no longer exists in the active ruleset.`,
        });
        continue;
      }

      if (currentDs.basePoints !== unit.pointsCost) {
        discrepancies.push({
          unitInstanceId: unit.instanceId,
          unitName: unit.datasheetName,
          severity: 'AMBER',
          category: 'POINTS_SHIFT',
          message: `Points changed from ${unit.pointsCost}pts to ${currentDs.basePoints}pts.`,
          oldValue: `${unit.pointsCost}`,
          newValue: `${currentDs.basePoints}`,
        });
      }
    }

    // ── Structural Validation ──────────────────────────────────────────────
    const validationErrors = validateRoster(
      rosterPayload,
      army.pointsLimit,
      army.detachmentPointsLimit,
      datasheetLookup
    );

    for (const err of validationErrors) {
      discrepancies.push({
        unitInstanceId: err.unitInstanceId || '',
        unitName: '',
        severity: err.severity === 'ERROR' ? 'RED' : 'AMBER',
        category: err.code === 'RULE_OF_THREE' ? 'DP_VIOLATION' : 'INVALID_LOADOUT',
        message: err.message,
      });
    }

    const result: AuditResult = {
      rosterId: army.id,
      rulesetVersionCompared: '11.1.0-2026-Q3',
      discrepancies,
      isCompliant: discrepancies.filter(d => d.severity === 'RED').length === 0,
      auditedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Audit]', err);
    res.status(500).json({ success: false, error: { code: 'AUDIT_ERROR', message: 'Failed to run audit.' } });
  }
});

export { router as auditRoutes };
