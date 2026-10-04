// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Detachment & Roster Validator
// Validates army composition against 11th Edition force org constraints
// ─────────────────────────────────────────────────────────────────────────────

import type { RosterPayload, Datasheet, BattlefieldRole } from '@forceorg/types';

export interface ValidationError {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  unitInstanceId?: string;
}

/**
 * Validates the roster's total points against the game's points limit.
 */
export function validatePointsLimit(
  roster: RosterPayload,
  pointsLimit: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (roster.totalPoints > pointsLimit) {
    errors.push({
      code: 'POINTS_EXCEEDED',
      severity: 'ERROR',
      message: `Roster total (${roster.totalPoints}pts) exceeds the ${pointsLimit}pt limit by ${roster.totalPoints - pointsLimit}pts.`,
    });
  }
  return errors;
}

/**
 * Validates Detachment Points usage against the DP budget.
 */
export function validateDetachmentPoints(
  roster: RosterPayload,
  dpLimit: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (roster.detachmentPointsUsed > dpLimit) {
    errors.push({
      code: 'DP_EXCEEDED',
      severity: 'ERROR',
      message: `Detachment Points used (${roster.detachmentPointsUsed}) exceeds the ${dpLimit} DP budget.`,
    });
  }
  return errors;
}

/**
 * Enforces the Rule of Three: no more than 3 copies of any non-BATTLELINE,
 * non-DEDICATED_TRANSPORT datasheet in matched play.
 */
export function validateRuleOfThree(
  roster: RosterPayload,
  datasheetLookup: Map<string, Datasheet>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const counts = new Map<string, { name: string; count: number; role: BattlefieldRole }>();

  for (const unit of roster.units) {
    const ds = datasheetLookup.get(unit.datasheetId);
    if (!ds) continue;

    const existing = counts.get(unit.datasheetId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(unit.datasheetId, { name: ds.name, count: 1, role: ds.battlefieldRole });
    }
  }

  for (const [dsId, entry] of counts) {
    // Exemptions: BATTLELINE and DEDICATED_TRANSPORT are not capped at 3
    if (entry.role === 'BATTLELINE' || entry.role === 'DEDICATED_TRANSPORT') continue;

    if (entry.count > 3) {
      errors.push({
        code: 'RULE_OF_THREE',
        severity: 'ERROR',
        message: `"${entry.name}" appears ${entry.count} times. Maximum 3 copies allowed in matched play.`,
      });
    }
  }

  return errors;
}

/**
 * Validates that all CHARACTER units marked as attached actually have
 * valid bodyguard assignments.
 */
export function validateAttachments(
  roster: RosterPayload,
  datasheetLookup: Map<string, Datasheet>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const unit of roster.units) {
    const ds = datasheetLookup.get(unit.datasheetId);
    if (!ds) continue;

    // If this unit is attached to a leader, ensure the leader exists in the roster
    if (unit.attachedLeaderId) {
      const leaderUnit = roster.units.find(u => u.instanceId === unit.attachedLeaderId);
      if (!leaderUnit) {
        errors.push({
          code: 'ORPHAN_ATTACHMENT',
          severity: 'ERROR',
          message: `Unit "${unit.datasheetName}" references leader instance "${unit.attachedLeaderId}" which is not in the roster.`,
          unitInstanceId: unit.instanceId,
        });
      }
    }
  }

  return errors;
}

/**
 * Runs all validation checks on a roster and returns aggregated errors.
 */
export function validateRoster(
  roster: RosterPayload,
  pointsLimit: number,
  dpLimit: number,
  datasheetLookup: Map<string, Datasheet>
): ValidationError[] {
  return [
    ...validatePointsLimit(roster, pointsLimit),
    ...validateDetachmentPoints(roster, dpLimit),
    ...validateRuleOfThree(roster, datasheetLookup),
    ...validateAttachments(roster, datasheetLookup),
  ];
}
