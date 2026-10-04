import { describe, it, expect } from 'vitest';
import {
  validatePointsLimit,
  validateDetachmentPoints,
  validateRuleOfThree,
  validateAttachments,
  validateRoster,
} from '../detachment-validator';
import type { RosterPayload, Datasheet } from '@forceorg/types';

describe('Detachment & Roster Validator', () => {
  describe('validatePointsLimit', () => {
    it('returns no errors when totalPoints is under the limit', () => {
      const roster: RosterPayload = { units: [], totalPoints: 1850, detachmentPointsUsed: 0 };
      const errors = validatePointsLimit(roster, 2000);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors when totalPoints is exactly equal to the limit', () => {
      const roster: RosterPayload = { units: [], totalPoints: 2000, detachmentPointsUsed: 0 };
      const errors = validatePointsLimit(roster, 2000);
      expect(errors).toHaveLength(0);
    });

    it('returns POINTS_EXCEEDED error when totalPoints exceeds the limit', () => {
      const roster: RosterPayload = { units: [], totalPoints: 2050, detachmentPointsUsed: 0 };
      const errors = validatePointsLimit(roster, 2000);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('POINTS_EXCEEDED');
      expect(errors[0].severity).toBe('ERROR');
      expect(errors[0].message).toContain('exceeds the 2000pt limit by 50pts');
    });
  });

  describe('validateDetachmentPoints', () => {
    it('returns no errors when detachmentPointsUsed is within budget', () => {
      const roster: RosterPayload = { units: [], totalPoints: 1000, detachmentPointsUsed: 2 };
      const errors = validateDetachmentPoints(roster, 3);
      expect(errors).toHaveLength(0);
    });

    it('returns DP_EXCEEDED error when detachmentPointsUsed exceeds the limit', () => {
      const roster: RosterPayload = { units: [], totalPoints: 1000, detachmentPointsUsed: 4 };
      const errors = validateDetachmentPoints(roster, 3);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('DP_EXCEEDED');
      expect(errors[0].message).toContain('exceeds the 3 DP budget');
    });
  });

  describe('validateRuleOfThree', () => {
    const makeDatasheet = (id: string, name: string, role: any): Datasheet => ({
      id,
      name,
      battlefieldRole: role,
      basePoints: 100,
      detachmentPointsCost: 0,
      factionId: 'adeptus_astartes',
      unitComposition: { models: [] },
      stats: {},
      keywords: [],
      isAlliedEligible: false,
      canonicalImageUrl: '',
      canonicalThumbUrl: '',
      createdAt: '',
    });

    const dsTerminator = makeDatasheet('ds-term', 'Terminator Squad', 'INFANTRY');
    const dsIntercessor = makeDatasheet('ds-inter', 'Intercessor Squad', 'BATTLELINE');
    const dsRhino = makeDatasheet('ds-rhino', 'Rhino', 'DEDICATED_TRANSPORT');

    const lookup = new Map<string, Datasheet>([
      ['ds-term', dsTerminator],
      ['ds-inter', dsIntercessor],
      ['ds-rhino', dsRhino],
    ]);

    it('allows up to 3 copies of standard units', () => {
      const roster: RosterPayload = {
        totalPoints: 500,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'u1', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
          { instanceId: 'u2', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
          { instanceId: 'u3', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
        ],
      };
      const errors = validateRuleOfThree(roster, lookup);
      expect(errors).toHaveLength(0);
    });

    it('rejects 4 copies of standard units', () => {
      const roster: RosterPayload = {
        totalPoints: 740,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'u1', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
          { instanceId: 'u2', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
          { instanceId: 'u3', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
          { instanceId: 'u4', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [] },
        ],
      };
      const errors = validateRuleOfThree(roster, lookup);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('RULE_OF_THREE');
      expect(errors[0].message).toContain('appears 4 times. Maximum 3 copies allowed');
    });

    it('exempts BATTLELINE units from the Rule of Three', () => {
      const roster: RosterPayload = {
        totalPoints: 400,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'u1', datasheetId: 'ds-inter', datasheetName: 'Intercessor Squad', modelCount: 5, pointsCost: 80, wargearSelections: [] },
          { instanceId: 'u2', datasheetId: 'ds-inter', datasheetName: 'Intercessor Squad', modelCount: 5, pointsCost: 80, wargearSelections: [] },
          { instanceId: 'u3', datasheetId: 'ds-inter', datasheetName: 'Intercessor Squad', modelCount: 5, pointsCost: 80, wargearSelections: [] },
          { instanceId: 'u4', datasheetId: 'ds-inter', datasheetName: 'Intercessor Squad', modelCount: 5, pointsCost: 80, wargearSelections: [] },
          { instanceId: 'u5', datasheetId: 'ds-inter', datasheetName: 'Intercessor Squad', modelCount: 5, pointsCost: 80, wargearSelections: [] },
        ],
      };
      const errors = validateRuleOfThree(roster, lookup);
      expect(errors).toHaveLength(0);
    });

    it('exempts DEDICATED_TRANSPORT units from the Rule of Three', () => {
      const roster: RosterPayload = {
        totalPoints: 300,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'u1', datasheetId: 'ds-rhino', datasheetName: 'Rhino', modelCount: 1, pointsCost: 75, wargearSelections: [] },
          { instanceId: 'u2', datasheetId: 'ds-rhino', datasheetName: 'Rhino', modelCount: 1, pointsCost: 75, wargearSelections: [] },
          { instanceId: 'u3', datasheetId: 'ds-rhino', datasheetName: 'Rhino', modelCount: 1, pointsCost: 75, wargearSelections: [] },
          { instanceId: 'u4', datasheetId: 'ds-rhino', datasheetName: 'Rhino', modelCount: 1, pointsCost: 75, wargearSelections: [] },
        ],
      };
      const errors = validateRuleOfThree(roster, lookup);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateAttachments', () => {
    const lookup = new Map<string, Datasheet>([
      ['ds-term', { id: 'ds-term', name: 'Terminator Squad' } as any],
      ['ds-cap', { id: 'ds-cap', name: 'Captain' } as any],
    ]);

    it('validates legitimate attached leader references', () => {
      const roster: RosterPayload = {
        totalPoints: 280,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'cap-1', datasheetId: 'ds-cap', datasheetName: 'Captain', modelCount: 1, pointsCost: 95, wargearSelections: [] },
          { instanceId: 'term-1', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [], attachedLeaderId: 'cap-1' },
        ],
      };
      const errors = validateAttachments(roster, lookup);
      expect(errors).toHaveLength(0);
    });

    it('detects orphan attachments when referenced leader does not exist in roster', () => {
      const roster: RosterPayload = {
        totalPoints: 185,
        detachmentPointsUsed: 0,
        units: [
          { instanceId: 'term-1', datasheetId: 'ds-term', datasheetName: 'Terminator Squad', modelCount: 5, pointsCost: 185, wargearSelections: [], attachedLeaderId: 'missing-cap-id' },
        ],
      };
      const errors = validateAttachments(roster, lookup);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('ORPHAN_ATTACHMENT');
      expect(errors[0].unitInstanceId).toBe('term-1');
    });
  });

  describe('validateRoster', () => {
    it('aggregates multiple violations simultaneously', () => {
      const lookup = new Map<string, Datasheet>();
      const roster: RosterPayload = {
        totalPoints: 2100,
        detachmentPointsUsed: 5,
        units: [],
      };
      const errors = validateRoster(roster, 2000, 3, lookup);
      expect(errors.some(e => e.code === 'POINTS_EXCEEDED')).toBe(true);
      expect(errors.some(e => e.code === 'DP_EXCEEDED')).toBe(true);
    });
  });
});
