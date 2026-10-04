// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Stratagem Filter Engine (§6.2)
// Filters available stratagems by unit keywords and active battle phase
// ─────────────────────────────────────────────────────────────────────────────

import type { Stratagem, BattlePhase } from '@forceorg/types';

/**
 * Checks if a unit's keyword set satisfies a stratagem's required keywords.
 *
 * A stratagem is eligible if EITHER:
 * - It has no required keywords (universally available), OR
 * - The unit possesses at least one of the required keywords
 */
export function unitSatisfiesKeywords(
  unitKeywords: string[],
  requiredKeywords: string[]
): boolean {
  if (requiredKeywords.length === 0) return true;
  const upperUnit = new Set(unitKeywords.map(k => k.toUpperCase()));
  return requiredKeywords.some(rk => upperUnit.has(rk.toUpperCase()));
}

/**
 * Checks if a stratagem is available during the given battle phase.
 */
export function isPhaseActive(
  stratagemPhase: BattlePhase,
  currentPhase: BattlePhase
): boolean {
  if (stratagemPhase === 'ANY') return true;
  return stratagemPhase === currentPhase;
}

/**
 * Filters a list of stratagems to those eligible for a specific unit
 * during a specific battle phase.
 */
export function filterStratagems(
  allStratagems: Stratagem[],
  unitKeywords: string[],
  currentPhase: BattlePhase,
  detachmentId?: string | null
): Stratagem[] {
  return allStratagems.filter(strat => {
    // Phase check
    if (!isPhaseActive(strat.phase, currentPhase)) return false;

    // Keyword check
    if (!unitSatisfiesKeywords(unitKeywords, strat.requiredKeywords)) return false;

    // Detachment check: core stratagems are always available;
    // detachment stratagems must match the player's detachment
    if (strat.category === 'DETACHMENT' && strat.detachmentId) {
      if (!detachmentId || strat.detachmentId !== detachmentId) return false;
    }

    return true;
  });
}

/**
 * Groups stratagems by their category for UI display.
 */
export function groupStratagemsByCategory(
  stratagems: Stratagem[]
): { core: Stratagem[]; detachment: Stratagem[] } {
  return {
    core: stratagems.filter(s => s.category === 'CORE'),
    detachment: stratagems.filter(s => s.category === 'DETACHMENT'),
  };
}
