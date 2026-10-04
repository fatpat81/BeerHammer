// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Composite Unit Attachment Resolver (§6.1)
// Merges Character + Bodyguard into a single runtime composite unit
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Datasheet,
  WeaponProfile,
  Ability,
  CompositeUnit,
  LeaderCompatibility,
  ModelHealth,
  DatasheetStats,
} from '@forceorg/types';

/**
 * Validates whether a Character datasheet can legally attach to a Bodyguard datasheet
 * by checking the leader_compatibility_11e junction table.
 */
export function isAttachmentValid(
  leaderDatasheetId: string,
  bodyguardDatasheetId: string,
  compatibilityTable: LeaderCompatibility[]
): boolean {
  return compatibilityTable.some(
    entry =>
      entry.leaderDatasheetId === leaderDatasheetId &&
      entry.bodyguardDatasheetId === bodyguardDatasheetId
  );
}

/**
 * Resolves the effective toughness of a composite unit.
 *
 * 11th Edition Rule: When defending, the unit uses the Bodyguard's toughness.
 * The Leader's toughness is suppressed until all bodyguard models are destroyed.
 */
export function resolveEffectiveToughness(
  leaderStats: DatasheetStats,
  bodyguardStats: DatasheetStats,
  bodyguardModelsAlive: number
): number {
  if (bodyguardModelsAlive > 0) {
    return bodyguardStats.toughness;
  }
  return leaderStats.toughness;
}

/**
 * Merges keyword arrays from both datasheets, deduplicating.
 */
export function mergeKeywords(
  leaderKeywords: string[],
  bodyguardKeywords: string[]
): string[] {
  const set = new Set<string>([...leaderKeywords, ...bodyguardKeywords]);
  return Array.from(set).sort();
}

/**
 * Merges weapon profiles from both the leader and bodyguard datasheets.
 */
export function mergeWeapons(
  leaderWeapons: WeaponProfile[],
  bodyguardWeapons: WeaponProfile[]
): WeaponProfile[] {
  const seen = new Set<string>();
  const merged: WeaponProfile[] = [];

  for (const weapon of [...leaderWeapons, ...bodyguardWeapons]) {
    if (!seen.has(weapon.id)) {
      seen.add(weapon.id);
      merged.push(weapon);
    }
  }

  return merged;
}

/**
 * Merges abilities from both datasheets, tagging each with its source.
 */
export function mergeAbilities(
  leaderAbilities: Ability[],
  bodyguardAbilities: Ability[]
): Ability[] {
  return [...leaderAbilities, ...bodyguardAbilities];
}

/**
 * Builds a full CompositeUnit runtime from a leader + bodyguard pair.
 */
export function resolveCompositeUnit(
  leader: Datasheet,
  bodyguard: Datasheet,
  leaderWeapons: WeaponProfile[],
  bodyguardWeapons: WeaponProfile[],
  leaderAbilities: Ability[],
  bodyguardAbilities: Ability[],
  compatibilityTable: LeaderCompatibility[]
): CompositeUnit | null {
  if (!isAttachmentValid(leader.id, bodyguard.id, compatibilityTable)) {
    return null;
  }

  return {
    leader,
    bodyguard,
    combinedKeywords: mergeKeywords(leader.keywords, bodyguard.keywords),
    effectiveToughness: resolveEffectiveToughness(leader.stats, bodyguard.stats, 1),
    mergedWeapons: mergeWeapons(leaderWeapons, bodyguardWeapons),
    mergedAbilities: mergeAbilities(leaderAbilities, bodyguardAbilities),
  };
}

/**
 * Determines which model receives the next wound allocation.
 *
 * 11th Edition: Wounds go to Bodyguard models first. The Leader cannot take
 * wounds until all Bodyguard models are destroyed — unless the attacking weapon
 * has the [PRECISION] ability.
 */
export function allocateWound(
  models: ModelHealth[],
  hasPrecision: boolean = false
): { targetModelId: string; updatedModels: ModelHealth[] } | null {
  // PRECISION: target the leader directly if alive
  if (hasPrecision) {
    const leader = models.find(m => m.isLeader && m.currentWounds > 0);
    if (leader) {
      return {
        targetModelId: leader.id,
        updatedModels: models.map(m =>
          m.id === leader.id ? { ...m, currentWounds: m.currentWounds - 1 } : m
        ),
      };
    }
  }

  // Standard: allocate to first alive bodyguard, then leader
  const bodyguardTarget = models.find(m => !m.isLeader && m.currentWounds > 0);
  if (bodyguardTarget) {
    return {
      targetModelId: bodyguardTarget.id,
      updatedModels: models.map(m =>
        m.id === bodyguardTarget.id ? { ...m, currentWounds: m.currentWounds - 1 } : m
      ),
    };
  }

  // All bodyguards dead — target leader
  const leaderTarget = models.find(m => m.isLeader && m.currentWounds > 0);
  if (leaderTarget) {
    return {
      targetModelId: leaderTarget.id,
      updatedModels: models.map(m =>
        m.id === leaderTarget.id ? { ...m, currentWounds: m.currentWounds - 1 } : m
      ),
    };
  }

  // Unit destroyed
  return null;
}

/**
 * Checks if a composite unit is fully destroyed (all models at 0 wounds).
 */
export function isUnitDestroyed(models: ModelHealth[]): boolean {
  return models.every(m => m.currentWounds === 0);
}

/**
 * Counts surviving bodyguard models (wounds > 0, not leader).
 */
export function countAliveBodyguards(models: ModelHealth[]): number {
  return models.filter(m => !m.isLeader && m.currentWounds > 0).length;
}
