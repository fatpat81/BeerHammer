import { describe, it, expect } from 'vitest';
import {
  unitSatisfiesKeywords,
  isPhaseActive,
  filterStratagems,
  groupStratagemsByCategory,
} from '../stratagem-filter';
import type { Stratagem } from '@forceorg/types';

describe('Stratagem Filter Engine', () => {
  describe('unitSatisfiesKeywords', () => {
    it('returns true if stratagem requires no keywords (universal)', () => {
      expect(unitSatisfiesKeywords(['INFANTRY', 'CHARACTER'], [])).toBe(true);
    });

    it('returns true when unit has at least one matching required keyword', () => {
      expect(unitSatisfiesKeywords(['INFANTRY', 'IMPERIUM'], ['INFANTRY'])).toBe(true);
      expect(unitSatisfiesKeywords(['VEHICLE', 'SMOKE'], ['INFANTRY', 'VEHICLE'])).toBe(true);
    });

    it('handles case-insensitive keyword comparisons', () => {
      expect(unitSatisfiesKeywords(['infantry', 'character'], ['INFANTRY'])).toBe(true);
      expect(unitSatisfiesKeywords(['INFANTRY'], ['infantry'])).toBe(true);
    });

    it('returns false when unit has none of the required keywords', () => {
      expect(unitSatisfiesKeywords(['MONSTER'], ['INFANTRY', 'VEHICLE'])).toBe(false);
    });
  });

  describe('isPhaseActive', () => {
    it('returns true when stratagem phase is ANY', () => {
      expect(isPhaseActive('ANY', 'SHOOTING')).toBe(true);
      expect(isPhaseActive('ANY', 'COMMAND')).toBe(true);
      expect(isPhaseActive('ANY', 'CHARGE')).toBe(true);
    });

    it('returns true when stratagem phase matches current battle phase', () => {
      expect(isPhaseActive('SHOOTING', 'SHOOTING')).toBe(true);
      expect(isPhaseActive('FIGHT', 'FIGHT')).toBe(true);
    });

    it('returns false when stratagem phase differs from current battle phase', () => {
      expect(isPhaseActive('SHOOTING', 'MOVEMENT')).toBe(false);
      expect(isPhaseActive('CHARGE', 'COMMAND')).toBe(false);
    });
  });

  describe('filterStratagems', () => {
    const mockStratagems: Stratagem[] = [
      {
        id: 's1',
        name: 'Command Re-roll',
        category: 'CORE',
        phase: 'ANY',
        cpCost: 1,
        description: 'Re-roll 1 dice roll.',
        requiredKeywords: [],
      },
      {
        id: 's2',
        name: 'Armour of Contempt',
        category: 'DETACHMENT',
        detachmentId: '1st Company Task Force',
        phase: 'SHOOTING',
        cpCost: 1,
        description: 'Worsen AP by 1.',
        requiredKeywords: ['ADEPTUS ASTARTES'],
      },
      {
        id: 's3',
        name: 'Wrath of the Lion',
        category: 'DETACHMENT',
        detachmentId: 'Unforgiven Task Force',
        phase: 'FIGHT',
        cpCost: 2,
        description: 'Melee mortal wounds.',
        requiredKeywords: ['INFANTRY'],
      },
      {
        id: 's4',
        name: 'Smokescreen',
        category: 'CORE',
        phase: 'SHOOTING',
        cpCost: 1,
        description: 'Stealth and Benefit of Cover.',
        requiredKeywords: ['SMOKE'],
      },
    ];

    it('returns Core stratagems with ANY phase unconditionally', () => {
      const result = filterStratagems(mockStratagems, ['INFANTRY'], 'COMMAND', '1st Company Task Force');
      expect(result.some(s => s.id === 's1')).toBe(true);
    });

    it('filters out stratagems for inactive phases', () => {
      const result = filterStratagems(mockStratagems, ['ADEPTUS ASTARTES'], 'COMMAND', '1st Company Task Force');
      expect(result.some(s => s.id === 's2')).toBe(false); // s2 is SHOOTING phase
    });

    it('filters out stratagems when required keywords are missing', () => {
      // Unit has ADEPTUS ASTARTES but not SMOKE during SHOOTING phase
      const result = filterStratagems(mockStratagems, ['ADEPTUS ASTARTES'], 'SHOOTING', '1st Company Task Force');
      expect(result.some(s => s.id === 's4')).toBe(false); // s4 requires SMOKE
      expect(result.some(s => s.id === 's2')).toBe(true);  // s2 matches ADEPTUS ASTARTES
    });

    it('filters out detachment stratagems belonging to other detachments', () => {
      const result = filterStratagems(mockStratagems, ['INFANTRY'], 'FIGHT', '1st Company Task Force');
      expect(result.some(s => s.id === 's3')).toBe(false); // s3 belongs to Unforgiven Task Force
    });

    it('includes detachment stratagem when detachmentId and phase match', () => {
      const result = filterStratagems(mockStratagems, ['INFANTRY'], 'FIGHT', 'Unforgiven Task Force');
      expect(result.some(s => s.id === 's3')).toBe(true);
    });
  });

  describe('groupStratagemsByCategory', () => {
    it('partitions stratagems correctly into core and detachment lists', () => {
      const strats: Stratagem[] = [
        { id: '1', name: 'Core 1', category: 'CORE', phase: 'ANY', cpCost: 1, description: '', requiredKeywords: [] },
        { id: '2', name: 'Det 1', category: 'DETACHMENT', phase: 'ANY', cpCost: 1, description: '', requiredKeywords: [] },
        { id: '3', name: 'Core 2', category: 'CORE', phase: 'ANY', cpCost: 1, description: '', requiredKeywords: [] },
      ];

      const grouped = groupStratagemsByCategory(strats);
      expect(grouped.core).toHaveLength(2);
      expect(grouped.detachment).toHaveLength(1);
      expect(grouped.core.map(s => s.name)).toEqual(['Core 1', 'Core 2']);
      expect(grouped.detachment[0].name).toBe('Det 1');
    });
  });
});
