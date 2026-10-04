// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Rules Diff Analyzer
// Compares incoming data against production DB to generate delta changelogs
// ─────────────────────────────────────────────────────────────────────────────

import type { SyncDelta } from '@forceorg/types';

interface DatasheetRecord {
  id: string;
  name: string;
  basePoints: number;
  keywords: string[];
}

/**
 * Analyzes differences between incoming and existing datasheet records.
 */
export function analyzeDiff(
  incoming: DatasheetRecord[],
  existing: DatasheetRecord[]
): SyncDelta {
  const existingMap = new Map(existing.map(e => [e.name, e]));
  const incomingMap = new Map(incoming.map(i => [i.name, i]));

  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  const pointChanges: Array<{ datasheetName: string; oldPoints: number; newPoints: number }> = [];

  // Detect added and modified
  for (const [name, inc] of incomingMap) {
    const ex = existingMap.get(name);
    if (!ex) {
      added.push(name);
      continue;
    }

    const hasPointChange = inc.basePoints !== ex.basePoints;
    const hasKeywordChange =
      inc.keywords.length !== ex.keywords.length ||
      inc.keywords.some(k => !ex.keywords.includes(k));

    if (hasPointChange || hasKeywordChange) {
      modified.push(name);
    }

    if (hasPointChange) {
      pointChanges.push({
        datasheetName: name,
        oldPoints: ex.basePoints,
        newPoints: inc.basePoints,
      });
    }
  }

  // Detect removed
  for (const [name] of existingMap) {
    if (!incomingMap.has(name)) {
      removed.push(name);
    }
  }

  return { added, modified, removed, pointChanges };
}

/**
 * Generates a human-readable changelog summary from a SyncDelta.
 */
export function formatChangelogSummary(delta: SyncDelta): string {
  const lines: string[] = ['=== ForceOrg-40k Wahapedia Sync Delta ===', ''];

  if (delta.added.length > 0) {
    lines.push(`📗 ADDED (${delta.added.length}):`);
    delta.added.forEach(n => lines.push(`  + ${n}`));
    lines.push('');
  }

  if (delta.modified.length > 0) {
    lines.push(`📙 MODIFIED (${delta.modified.length}):`);
    delta.modified.forEach(n => lines.push(`  ~ ${n}`));
    lines.push('');
  }

  if (delta.removed.length > 0) {
    lines.push(`📕 REMOVED (${delta.removed.length}):`);
    delta.removed.forEach(n => lines.push(`  - ${n}`));
    lines.push('');
  }

  if (delta.pointChanges.length > 0) {
    lines.push(`💰 POINTS CHANGES (${delta.pointChanges.length}):`);
    delta.pointChanges.forEach(pc => {
      const direction = pc.newPoints > pc.oldPoints ? '↑' : '↓';
      lines.push(`  ${direction} ${pc.datasheetName}: ${pc.oldPoints}pts → ${pc.newPoints}pts`);
    });
    lines.push('');
  }

  if (delta.added.length === 0 && delta.modified.length === 0 && delta.removed.length === 0) {
    lines.push('✅ No changes detected. Database is up to date.');
  }

  return lines.join('\n');
}
