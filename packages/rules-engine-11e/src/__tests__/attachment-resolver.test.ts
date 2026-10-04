import { describe, it, expect } from 'vitest';
import type { ModelHealth, LeaderCompatibility, DatasheetStats } from '@forceorg/types';
import {
  isAttachmentValid,
  resolveEffectiveToughness,
  mergeKeywords,
  allocateWound,
  isUnitDestroyed,
  countAliveBodyguards,
} from '../attachment-resolver';

const CAPTAIN_ID = '11111111-1111-4000-8000-000000000001';
const TERMINATOR_ID = '11111111-1111-4000-8000-000000000002';
const INTERCESSOR_ID = '11111111-1111-4000-8000-000000000003';

const compatibilityTable: LeaderCompatibility[] = [
  { id: 'compat-1', leaderDatasheetId: CAPTAIN_ID, bodyguardDatasheetId: TERMINATOR_ID },
];

describe('isAttachmentValid', () => {
  it('returns true for valid leader/bodyguard pair', () => {
    expect(isAttachmentValid(CAPTAIN_ID, TERMINATOR_ID, compatibilityTable)).toBe(true);
  });

  it('returns false for invalid pair', () => {
    expect(isAttachmentValid(CAPTAIN_ID, INTERCESSOR_ID, compatibilityTable)).toBe(false);
  });

  it('returns false for reversed pair', () => {
    expect(isAttachmentValid(TERMINATOR_ID, CAPTAIN_ID, compatibilityTable)).toBe(false);
  });
});

describe('resolveEffectiveToughness', () => {
  const leaderStats: DatasheetStats = { movement: '5"', toughness: 4, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 };
  const bodyguardStats: DatasheetStats = { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 };

  it('uses bodyguard toughness while bodyguards alive', () => {
    expect(resolveEffectiveToughness(leaderStats, bodyguardStats, 4)).toBe(5);
  });

  it('falls back to leader toughness when all bodyguards dead', () => {
    expect(resolveEffectiveToughness(leaderStats, bodyguardStats, 0)).toBe(4);
  });
});

describe('mergeKeywords', () => {
  it('combines and deduplicates keywords', () => {
    const merged = mergeKeywords(
      ['INFANTRY', 'CHARACTER', 'TERMINATOR'],
      ['INFANTRY', 'TERMINATOR', 'IMPERIUM']
    );
    expect(merged).toContain('CHARACTER');
    expect(merged).toContain('IMPERIUM');
    expect(merged.filter(k => k === 'INFANTRY')).toHaveLength(1);
  });

  it('returns sorted output', () => {
    const merged = mergeKeywords(['ZEBRA', 'ALPHA'], ['BETA']);
    expect(merged).toEqual(['ALPHA', 'BETA', 'ZEBRA']);
  });
});

describe('allocateWound', () => {
  function makeModels(): ModelHealth[] {
    return [
      { id: 'leader-1', modelName: 'Captain', isLeader: true, maxWounds: 5, currentWounds: 5 },
      { id: 'trooper-1', modelName: 'Terminator 1', isLeader: false, maxWounds: 3, currentWounds: 3 },
      { id: 'trooper-2', modelName: 'Terminator 2', isLeader: false, maxWounds: 3, currentWounds: 3 },
    ];
  }

  it('allocates wounds to bodyguards first', () => {
    const result = allocateWound(makeModels());
    expect(result).not.toBeNull();
    expect(result!.targetModelId).toBe('trooper-1');
    expect(result!.updatedModels.find(m => m.id === 'trooper-1')!.currentWounds).toBe(2);
  });

  it('allocates to leader only after all bodyguards dead', () => {
    const models: ModelHealth[] = [
      { id: 'leader-1', modelName: 'Captain', isLeader: true, maxWounds: 5, currentWounds: 5 },
      { id: 'trooper-1', modelName: 'Terminator 1', isLeader: false, maxWounds: 3, currentWounds: 0 },
      { id: 'trooper-2', modelName: 'Terminator 2', isLeader: false, maxWounds: 3, currentWounds: 0 },
    ];
    const result = allocateWound(models);
    expect(result!.targetModelId).toBe('leader-1');
  });

  it('PRECISION targets leader even with bodyguards alive', () => {
    const result = allocateWound(makeModels(), true);
    expect(result!.targetModelId).toBe('leader-1');
    expect(result!.updatedModels.find(m => m.id === 'leader-1')!.currentWounds).toBe(4);
  });

  it('returns null when entire unit is destroyed', () => {
    const models: ModelHealth[] = [
      { id: 'leader-1', modelName: 'Captain', isLeader: true, maxWounds: 5, currentWounds: 0 },
      { id: 'trooper-1', modelName: 'Terminator 1', isLeader: false, maxWounds: 3, currentWounds: 0 },
    ];
    expect(allocateWound(models)).toBeNull();
  });
});

describe('isUnitDestroyed', () => {
  it('returns true when all models at 0 wounds', () => {
    expect(isUnitDestroyed([
      { id: '1', modelName: 'A', isLeader: true, maxWounds: 5, currentWounds: 0 },
      { id: '2', modelName: 'B', isLeader: false, maxWounds: 3, currentWounds: 0 },
    ])).toBe(true);
  });

  it('returns false when any model has wounds', () => {
    expect(isUnitDestroyed([
      { id: '1', modelName: 'A', isLeader: true, maxWounds: 5, currentWounds: 1 },
      { id: '2', modelName: 'B', isLeader: false, maxWounds: 3, currentWounds: 0 },
    ])).toBe(false);
  });
});

describe('countAliveBodyguards', () => {
  it('counts only non-leader models with wounds > 0', () => {
    expect(countAliveBodyguards([
      { id: '1', modelName: 'Captain', isLeader: true, maxWounds: 5, currentWounds: 5 },
      { id: '2', modelName: 'Term 1', isLeader: false, maxWounds: 3, currentWounds: 3 },
      { id: '3', modelName: 'Term 2', isLeader: false, maxWounds: 3, currentWounds: 0 },
      { id: '4', modelName: 'Term 3', isLeader: false, maxWounds: 3, currentWounds: 1 },
    ])).toBe(2);
  });
});
