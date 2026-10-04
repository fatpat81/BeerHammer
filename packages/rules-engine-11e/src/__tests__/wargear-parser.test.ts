import { describe, it, expect } from 'vitest';
import {
  compileWahapediaWargear,
  slugify,
  parseCountAndName,
  parseOptionList,
} from '../wargear-parser';

describe('slugify', () => {
  it('generates URL-safe weapon slugs', () => {
    expect(slugify('Storm Bolter')).toBe('wep_storm_bolter');
    expect(slugify('Master-crafted Power Weapon')).toBe('wep_master_crafted_power_weapon');
    expect(slugify('  Heavy Flamer  ')).toBe('wep_heavy_flamer');
  });
});

describe('parseCountAndName', () => {
  it('parses "1 Power Fist"', () => {
    expect(parseCountAndName('1 Power Fist')).toEqual({ count: 1, name: 'Power Fist' });
  });

  it('parses "2 Storm Bolters"', () => {
    expect(parseCountAndName('2 Storm Bolters')).toEqual({ count: 2, name: 'Storm Bolters' });
  });

  it('defaults count to 1 for bare names', () => {
    expect(parseCountAndName('Boltgun')).toEqual({ count: 1, name: 'Boltgun' });
  });

  it('strips bullet points', () => {
    expect(parseCountAndName('• 1 Plasma Pistol')).toEqual({ count: 1, name: 'Plasma Pistol' });
  });
});

describe('parseOptionList', () => {
  it('splits comma-separated options', () => {
    const result = parseOptionList('1 Power Fist, 1 Thunder Hammer');
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Power Fist');
    expect(result[1]!.name).toBe('Thunder Hammer');
  });

  it('handles "or" connectors', () => {
    const result = parseOptionList('1 Plasma Pistol or 1 Hand Flamer');
    expect(result).toHaveLength(2);
  });

  it('filters out "1 of the following" preambles', () => {
    const result = parseOptionList('1 of the following, Power Fist, Thunder Hammer');
    expect(result.every(r => !r.name.includes('following'))).toBe(true);
  });
});

describe('compileWahapediaWargear', () => {
  it('parses scale-factor rules', () => {
    const input = 'For every 5 models in this unit, 1 model can replace its boltgun with 1 Heavy Bolter or 1 Missile Launcher';
    const ast = compileWahapediaWargear(input);

    expect(ast).toHaveLength(1);
    expect(ast[0]!.ruleType).toBe('REPLACE');
    expect(ast[0]!.scope.scaleFactor).toBe(5);
    expect(ast[0]!.scope.targetRole).toBe('TROOPER');
    expect(ast[0]!.replaces!.name).toContain('boltgun');
    expect(ast[0]!.options).toHaveLength(2);
    expect(ast[0]!.constraint.maxSelections).toBe('floor(unit.modelCount / 5)');
  });

  it('parses role-targeted replacement rules', () => {
    const input = "The Sergeant's boltgun can be replaced with 1 Plasma Pistol, 1 Power Fist";
    const ast = compileWahapediaWargear(input);

    expect(ast).toHaveLength(1);
    expect(ast[0]!.ruleType).toBe('REPLACE');
    expect(ast[0]!.scope.targetRole).toBe('SERGEANT');
    expect(ast[0]!.replaces!.name).toContain('boltgun');
    expect(ast[0]!.options.length).toBeGreaterThanOrEqual(2);
  });

  it('parses add-on equipment rules', () => {
    const input = 'Any model can be equipped with 1 Combat Knife';
    const ast = compileWahapediaWargear(input);

    expect(ast).toHaveLength(1);
    expect(ast[0]!.ruleType).toBe('ADD_ON');
    expect(ast[0]!.scope.targetRole).toBe('ANY');
    expect(ast[0]!.scope.modelLimit).toBe('ALL');
  });

  it('handles HTML input with tags', () => {
    const input = '<li>For every 5 models in this unit, 1 model can replace its boltgun with 1 Lascannon</li><li>The Champion can replace his bolt pistol with 1 Plasma Pistol</li>';
    const ast = compileWahapediaWargear(input);

    expect(ast.length).toBeGreaterThanOrEqual(2);
    expect(ast[0]!.scope.scaleFactor).toBe(5);
    expect(ast[1]!.scope.targetRole).toBe('SERGEANT');
  });

  it('parses numeric model count replacements', () => {
    const input = '2 models can replace their boltgun with 1 Meltagun or 1 Flamer';
    const ast = compileWahapediaWargear(input);

    expect(ast).toHaveLength(1);
    expect(ast[0]!.ruleType).toBe('REPLACE');
    expect(ast[0]!.scope.modelLimit).toBe(2);
    expect(ast[0]!.constraint.maxSelections).toBe(2);
  });

  it('returns empty array for unrecognized text', () => {
    const ast = compileWahapediaWargear('This unit has the Oath of Moment ability.');
    expect(ast).toHaveLength(0);
  });
});
