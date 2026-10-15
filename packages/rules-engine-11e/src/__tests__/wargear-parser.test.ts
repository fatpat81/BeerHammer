import { describe, it, expect } from 'vitest';
import {
  compileWahapediaWargear,
  slugify,
  parseCountAndName,
  parseOptionList,
  validateWargearLoadout,
  resolveEquippedWeapons,
  buildUnitWargearSlots,
  calculateUnitSquadPoints,
  getUnitBaseModelThreshold,
  normalizeBaseWeaponName,
  cleanDisplayName,
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

describe('validateWargearLoadout', () => {
  it('flags scale factor excess as RED tournament error', () => {
    const ast = compileWahapediaWargear(
      'For every 5 models in this unit, 1 model can replace its boltgun with 1 Plasma Gun'
    );
    // Squad of 5 allows 1 Plasma Gun. Testing with 2 Plasma Guns.
    const result = validateWargearLoadout({
      modelCount: 5,
      rules: ast,
      wargearSelections: [
        {
          ruleId: ast[0]!.id,
          selectedOptionId: 'wep_plasma_gun',
          weaponName: 'Plasma Gun',
          replacesWeaponName: 'boltgun',
          count: 2,
        },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.severity).toBe('RED');
    expect(result.errors[0]!.message).toContain('Tournament limit exceeded');
    expect(result.errors[0]!.message).toContain('Plasma Gun');
  });

  it('passes when wargear selections are within legal limits', () => {
    const ast = compileWahapediaWargear(
      'For every 5 models in this unit, 1 model can replace its boltgun with 1 Plasma Gun'
    );
    const result = validateWargearLoadout({
      modelCount: 10, // allows 2
      rules: ast,
      wargearSelections: [
        {
          ruleId: ast[0]!.id,
          selectedOptionId: 'wep_plasma_gun',
          weaponName: 'Plasma Gun',
          replacesWeaponName: 'boltgun',
          count: 2,
        },
      ],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('resolveEquippedWeapons', () => {
  const catalogWeapons = [
    {
      id: 'wep_bolt_rifle',
      slug: 'wep_bolt_rifle',
      name: 'Bolt Rifle',
      type: 'Ranged',
      range: '24"',
      attacks: '2',
      skill: '3+',
      strength: 4,
      armorPenetration: -1,
      damage: '1',
      keywords: ['Assault', 'Heavy'],
    },
    {
      id: 'wep_bolt_pistol',
      slug: 'wep_bolt_pistol',
      name: 'Bolt Pistol',
      type: 'Ranged',
      range: '12"',
      attacks: '1',
      skill: '3+',
      strength: 4,
      armorPenetration: 0,
      damage: '1',
      keywords: ['Pistol'],
    },
    {
      id: 'wep_ccw',
      slug: 'wep_ccw',
      name: 'Close Combat Weapon',
      type: 'Melee',
      range: 'Melee',
      attacks: '3',
      skill: '3+',
      strength: 4,
      armorPenetration: 0,
      damage: '1',
      keywords: [],
    },
    {
      id: 'wep_plasma_gun',
      slug: 'wep_plasma_gun',
      name: 'Plasma Gun',
      type: 'Ranged',
      range: '24"',
      attacks: '1',
      skill: '3+',
      strength: 7,
      armorPenetration: -2,
      damage: '1',
      keywords: ['Rapid Fire 1'],
    },
  ];

  it('renders default baseline loadout with model counts when no selections made', () => {
    const equipped = resolveEquippedWeapons(catalogWeapons, 5, [], false);
    expect(equipped.length).toBeGreaterThanOrEqual(3);
    const boltRifle = equipped.find(w => w.name === 'Bolt Rifle');
    expect(boltRifle).toBeDefined();
    expect(boltRifle?.count).toBe(5);
    expect(boltRifle?.displayName).toBe('5x Bolt Rifle');
  });

  it('deducts replaced weapon count and adds selected weapon in Battle Mode', () => {
    const selections = [
      {
        ruleId: 'r1',
        selectedOptionId: 'wep_plasma_gun',
        weaponName: 'Plasma Gun',
        replacesWeaponName: 'Bolt Rifle',
        count: 1,
      },
    ];
    const equipped = resolveEquippedWeapons(catalogWeapons, 5, selections, false);

    const boltRifle = equipped.find(w => w.name === 'Bolt Rifle');
    const plasmaGun = equipped.find(w => w.name === 'Plasma Gun');
    const boltPistol = equipped.find(w => w.name === 'Bolt Pistol');
    const ccw = equipped.find(w => w.name === 'Close Combat Weapon');

    expect(boltRifle?.count).toBe(4);
    expect(boltRifle?.displayName).toBe('4x Bolt Rifle');
    expect(plasmaGun?.count).toBe(1);
    expect(plasmaGun?.displayName).toBe('1x Plasma Gun');
    // Sidearm & Melee retained per Q12=A
    expect(boltPistol?.count).toBe(5);
    expect(ccw?.count).toBe(5);
  });

  it('resolves multi-profile firing modes (frag & krak) together', () => {
    const multiProfileWeapons = [
      {
        id: 'w1',
        slug: 'w1',
        name: 'Storm bolter',
        type: 'Ranged',
        range: '24"',
        attacks: '2',
        skill: '3+',
        strength: 4,
        armorPenetration: 0,
        damage: '1',
        keywords: [],
      },
      {
        id: 'w2',
        slug: 'w2',
        name: '➤ Cyclone missile launcher - frag',
        type: 'Ranged',
        range: '36"',
        attacks: '2D6',
        skill: '3+',
        strength: 4,
        armorPenetration: 0,
        damage: '1',
        keywords: ['Blast'],
      },
      {
        id: 'w3',
        slug: 'w3',
        name: '➤ Cyclone missile launcher - krak',
        type: 'Ranged',
        range: '36"',
        attacks: '2',
        skill: '3+',
        strength: 9,
        armorPenetration: -2,
        damage: 'D6',
        keywords: [],
      },
      {
        id: 'w4',
        slug: 'w4',
        name: 'Power fist',
        type: 'Melee',
        range: 'Melee',
        attacks: '3',
        skill: '3+',
        strength: 8,
        armorPenetration: -2,
        damage: '2',
        keywords: [],
      },
    ];

    const selections = [
      {
        ruleId: 'r_cyclone',
        selectedOptionId: 'wep_cyclone_missile_launcher',
        weaponName: 'Cyclone missile launcher',
        count: 1,
        role: 'SPECIAL',
      },
    ];

    const equipped = resolveEquippedWeapons(multiProfileWeapons, 5, selections, false);
    const frag = equipped.find(w => w.name.includes('Cyclone missile launcher - frag'));
    const krak = equipped.find(w => w.name.includes('Cyclone missile launcher - krak'));

    expect(frag).toBeDefined();
    expect(frag?.count).toBe(1);
    expect(krak).toBeDefined();
    expect(krak?.count).toBe(1);
  });

  it('handles squad melee weapon swaps (Terminator Power fist -> Chainfist)', () => {
    const terminatorWeapons = [
      {
        id: 'w_sb',
        slug: 'w_sb',
        name: 'Storm bolter',
        type: 'Ranged',
        range: '24"',
        attacks: '2',
        skill: '3+',
        strength: 4,
        armorPenetration: 0,
        damage: '1',
        keywords: [],
      },
      {
        id: 'w_pf',
        slug: 'w_pf',
        name: 'Power fist',
        type: 'Melee',
        range: 'Melee',
        attacks: '3',
        skill: '3+',
        strength: 8,
        armorPenetration: -2,
        damage: '2',
        keywords: [],
      },
      {
        id: 'w_cf',
        slug: 'w_cf',
        name: 'Chainfist',
        type: 'Melee',
        range: 'Melee',
        attacks: '3',
        skill: '4+',
        strength: 8,
        armorPenetration: -2,
        damage: '2',
        keywords: ['Anti-Vehicle 3+'],
      },
    ];

    const selections = [
      {
        ruleId: 'r_chainfist',
        selectedOptionId: 'wep_chainfist',
        weaponName: 'Chainfist',
        replacesWeaponName: 'Power fist',
        count: 2,
        role: 'SPECIAL',
      },
    ];

    const equipped = resolveEquippedWeapons(terminatorWeapons, 5, selections, false);
    const powerFist = equipped.find(w => w.name === 'Power fist');
    const chainfist = equipped.find(w => w.name === 'Chainfist');

    expect(powerFist?.count).toBe(3); // 5 - 2 = 3
    expect(chainfist?.count).toBe(2);
  });
});

describe('calculateUnitSquadPoints', () => {
  it('charges 10-man squad points for 6 models on a 5-man base squad (e.g. Terminators)', () => {
    // 5 Terminators = 160 pts
    const result5 = calculateUnitSquadPoints({
      basePoints: 160,
      modelCount: 5,
      baseModelCount: 5,
      isCharacter: false,
    });
    expect(result5.totalPoints).toBe(160);
    expect(result5.tierMultiplier).toBe(1);
    expect(result5.tierMaxModels).toBe(5);
    expect(result5.isUnderstrength).toBe(false);

    // 6 Terminators costs 10-man squad points (320 pts)
    const result6 = calculateUnitSquadPoints({
      basePoints: 160,
      modelCount: 6,
      baseModelCount: 5,
      isCharacter: false,
    });
    expect(result6.totalPoints).toBe(320);
    expect(result6.tierMultiplier).toBe(2);
    expect(result6.tierMaxModels).toBe(10);
    expect(result6.isUnderstrength).toBe(true);

    // 10 Terminators costs 320 pts
    const result10 = calculateUnitSquadPoints({
      basePoints: 160,
      modelCount: 10,
      baseModelCount: 5,
      isCharacter: false,
    });
    expect(result10.totalPoints).toBe(320);
    expect(result10.tierMultiplier).toBe(2);
    expect(result10.tierMaxModels).toBe(10);
    expect(result10.isUnderstrength).toBe(false);
  });

  it('charges 6-man squad points for 4 models on a 3-man base squad (e.g. Aggressors)', () => {
    const result4 = calculateUnitSquadPoints({
      basePoints: 110,
      modelCount: 4,
      baseModelCount: 3,
      isCharacter: false,
    });
    expect(result4.totalPoints).toBe(220);
    expect(result4.tierMultiplier).toBe(2);
    expect(result4.tierMaxModels).toBe(6);
    expect(result4.isUnderstrength).toBe(true);
  });

  it('includes enhancement points on top of unit points', () => {
    const result = calculateUnitSquadPoints({
      basePoints: 95,
      modelCount: 1,
      baseModelCount: 1,
      isCharacter: true,
      enhancementPoints: 15,
    });
    expect(result.totalPoints).toBe(110);
  });
});

describe('normalizeBaseWeaponName and cleanDisplayName', () => {
  it('strips arrow prefixes and firing modes', () => {
    expect(normalizeBaseWeaponName('➤ Cyclone missile launcher - frag')).toBe('Cyclone missile launcher');
    expect(normalizeBaseWeaponName('➤ Plasma pistol - supercharge')).toBe('Plasma pistol');
    expect(normalizeBaseWeaponName('• Boltgun')).toBe('Boltgun');
  });

  it('cleans display names without stripping weapon identity', () => {
    expect(cleanDisplayName('➤ Heavy Bolter')).toBe('Heavy Bolter');
    expect(cleanDisplayName('➤ Astartes grenade launcher - frag')).toBe('Astartes grenade launcher - frag');
  });
});

describe('buildUnitWargearSlots with support gear and melee', () => {
  it('creates support wargear add-on slots from unit abilities (e.g. Teleport Homer, Chaos Icon)', () => {
    const slots = buildUnitWargearSlots({
      catalogWeapons: [
        {
          id: 'w1',
          slug: 'w1',
          name: 'Storm bolter',
          type: 'Ranged',
          range: '24"',
          attacks: '2',
          skill: '3+',
          strength: 4,
          armorPenetration: 0,
          damage: '1',
          keywords: [],
        },
      ],
      abilities: [
        {
          name: 'Teleport Homer',
          description: 'Set up one Teleport Homer token for this unit.',
        },
      ],
      modelCount: 5,
    });

    expect(slots.addOnSlots.length).toBeGreaterThanOrEqual(1);
    const homer = slots.addOnSlots[0]!.options.find(o => o.name.toLowerCase().includes('teleport homer'));
    expect(homer).toBeDefined();
  });
});

describe('getUnitBaseModelThreshold', () => {
  it('correctly sets Terminator Squads to 5 models baseline (scaling to 10), even when raw JSON lists 4 models', () => {
    // BattleScribe raw JSON previously had 4 entries in modelComposition (1 Sergeant + 3 Troopers)
    const spaceMarineTerminators = {
      name: 'Terminator Squad',
      battlefieldRole: 'INFANTRY',
      keywords: ['INFANTRY', 'TERMINATOR'],
      modelComposition: [
        { name: 'Terminator Sergeant', count: 1 },
        { name: 'Terminator Squad', count: 1 },
        { name: 'Terminator Squad', count: 1 },
        { name: 'Terminator Squad', count: 1 },
      ],
    };

    const threshold = getUnitBaseModelThreshold(spaceMarineTerminators);
    expect(threshold).toBe(5);

    // Verify 5 models costs 1x base points, 6 models costs 2x (10-man squad tier)
    const points5 = calculateUnitSquadPoints({
      basePoints: 185,
      modelCount: 5,
      baseModelCount: threshold,
    });
    expect(points5.totalPoints).toBe(185);
    expect(points5.tierMaxModels).toBe(5);
    expect(points5.isUnderstrength).toBe(false);

    const points6 = calculateUnitSquadPoints({
      basePoints: 185,
      modelCount: 6,
      baseModelCount: threshold,
    });
    expect(points6.totalPoints).toBe(370);
    expect(points6.tierMaxModels).toBe(10);
    expect(points6.isUnderstrength).toBe(true);

    const points10 = calculateUnitSquadPoints({
      basePoints: 185,
      modelCount: 10,
      baseModelCount: threshold,
    });
    expect(points10.totalPoints).toBe(370);
    expect(points10.tierMaxModels).toBe(10);
    expect(points10.isUnderstrength).toBe(false);
  });

  it('correctly categorizes Terminator variants across all factions', () => {
    expect(getUnitBaseModelThreshold({ name: 'Terminator Assault Squad', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Deathwing Terminator Squad', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Wolf Guard Terminators', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Chaos Terminator Squad', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Blightlord Terminators', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Scarab Occult Terminators', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
    expect(getUnitBaseModelThreshold({ name: 'Grey Knights Terminator Squad', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(5);
  });

  it('correctly sets elite 3-model fireteams (Aggressors, Eradicators, Crisis, Deathshroud)', () => {
    expect(getUnitBaseModelThreshold({ name: 'Aggressor Squad', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Eradicator Squad', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Bladeguard Veteran Squad', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Inceptor Squad', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Deathshroud Terminators', battlefieldRole: 'INFANTRY', keywords: ['TERMINATOR'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Crisis Fireknife Battlesuits', battlefieldRole: 'INFANTRY', keywords: ['BATTLESUIT'] })).toBe(3);
  });

  it('correctly sets horde / 10-model squads (Boyz, Cultists, Shock Troops, Breachers, Poxwalkers, Guardians, Blood Claws)', () => {
    expect(getUnitBaseModelThreshold({ name: 'Boyz', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Cultist Mob', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Cadian Shock Troops', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Breacher Team', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Necron Warriors', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Poxwalkers', battlefieldRole: 'INFANTRY', keywords: ['FACTION: DEATH GUARD', 'INFANTRY', 'CHAOS', 'NURGLE', 'POXWALKERS'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Guardian Defenders', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Storm Guardians', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Battle Sisters Squad', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Blood Claws', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Tactical Squad', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(10);
    expect(getUnitBaseModelThreshold({ name: 'Custodian Guard', battlefieldRole: 'BATTLELINE', keywords: ['BATTLELINE', 'INFANTRY'] })).toBe(4);
  });

  it('correctly identifies single-model characters and vehicles', () => {
    expect(getUnitBaseModelThreshold({ name: 'Captain in Terminator Armour', battlefieldRole: 'CHARACTER', keywords: ['CHARACTER', 'TERMINATOR'] })).toBe(1);
    expect(getUnitBaseModelThreshold({ name: 'Chaos Lord', battlefieldRole: 'CHARACTER', keywords: ['CHARACTER'] })).toBe(1);
    expect(getUnitBaseModelThreshold({ name: 'Predator Tank', battlefieldRole: 'VEHICLE', keywords: ['VEHICLE'] })).toBe(1);
    expect(getUnitBaseModelThreshold({ name: 'Redemptor Dreadnought', battlefieldRole: 'VEHICLE', keywords: ['VEHICLE', 'WALKER'] })).toBe(1);
  });

  it('correctly identifies unique character retinues and fixed squads', () => {
    expect(getUnitBaseModelThreshold({ name: 'Company Heroes', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(4);
    expect(getUnitBaseModelThreshold({ name: 'Chaplain Grimaldus', battlefieldRole: 'CHARACTER', keywords: ['CHARACTER', 'EPIC HERO'] })).toBe(4);
    expect(getUnitBaseModelThreshold({ name: 'Marneus Calgar', battlefieldRole: 'CHARACTER', keywords: ['CHARACTER', 'EPIC HERO'] })).toBe(3);
    expect(getUnitBaseModelThreshold({ name: 'Accursed Cultists', battlefieldRole: 'INFANTRY', keywords: ['INFANTRY'] })).toBe(8);
  });

  it('guarantees Storm bolter and Power fist are available and identified for Terminator Squads', () => {
    const termWeapons: WeaponProfile[] = [
      { id: 'sb', slug: 'sb', name: 'Storm bolter', type: 'Ranged', range: '24"', attacks: '2', skill: '3+', strength: 4, armorPenetration: 0, damage: '1', keywords: [] },
      { id: 'ac', slug: 'ac', name: 'Assault Cannon', type: 'Ranged', range: '24"', attacks: '6', skill: '3+', strength: 6, armorPenetration: 0, damage: '1', keywords: [] },
      { id: 'hf', slug: 'hf', name: 'Heavy Flamer', type: 'Ranged', range: '12"', attacks: 'D6', skill: 'N/A', strength: 5, armorPenetration: -1, damage: '1', keywords: [] },
      { id: 'pf', slug: 'pf', name: 'Power fist', type: 'Melee', range: 'Melee', attacks: '3', skill: '3+', strength: 8, armorPenetration: -2, damage: '2', keywords: [] },
      { id: 'cf', slug: 'cf', name: 'Chainfist', type: 'Melee', range: 'Melee', attacks: '3', skill: '4+', strength: 8, armorPenetration: -2, damage: '2', keywords: [] },
      { id: 'pw', slug: 'pw', name: 'Power weapon', type: 'Melee', range: 'Melee', attacks: '4', skill: '3+', strength: 5, armorPenetration: -2, damage: '1', keywords: [] },
    ];

    const slots = buildUnitWargearSlots({
      catalogWeapons: termWeapons,
      isLeader: false,
      modelCount: 5,
      unitName: 'Terminator Squad',
      keywords: ['INFANTRY', 'TERMINATOR'],
    });

    // Primary ranged should be Storm bolter
    expect(slots.primaryRangedWeapon?.name).toBe('Storm bolter');
    // Base melee should be Power fist
    expect(slots.baseTroopMeleeWeapon?.name).toBe('Power fist');
    // Leader slots must include Sergeant Ranged Weapon
    const sgtRanged = slots.leaderSlots.find(s => s.id === 'slot_sergeant_ranged');
    expect(sgtRanged).toBeDefined();
    expect(sgtRanged?.replacesName).toBe('Storm bolter');
    // Special slots must include Heavy weapons
    const specialSlot = slots.squadSpecialSlots.find(s => s.id === 'slot_squad_special');
    expect(specialSlot).toBeDefined();
    expect(specialSlot?.replacesName).toBe('Storm bolter');
    expect(specialSlot?.options.some(o => o.name === 'Assault Cannon')).toBe(true);
  });

  it('resolves correct counts of Storm bolters and heavy weapons in Battle Mode', () => {
    const termWeapons: WeaponProfile[] = [
      { id: 'sb', slug: 'sb', name: 'Storm bolter', type: 'Ranged', range: '24"', attacks: '2', skill: '3+', strength: 4, armorPenetration: 0, damage: '1', keywords: [] },
      { id: 'ac', slug: 'ac', name: 'Assault Cannon', type: 'Ranged', range: '24"', attacks: '6', skill: '3+', strength: 6, armorPenetration: 0, damage: '1', keywords: [] },
      { id: 'pf', slug: 'pf', name: 'Power fist', type: 'Melee', range: 'Melee', attacks: '3', skill: '3+', strength: 8, armorPenetration: -2, damage: '2', keywords: [] },
    ];

    // 5-model squad with 1 Assault Cannon replacing 1 Storm bolter
    const equipped = resolveEquippedWeapons(
      termWeapons,
      5,
      [
        {
          ruleId: 'slot_squad_special',
          selectedOptionId: 'wep_assault_cannon',
          weaponName: 'Assault Cannon',
          replacesWeaponName: 'Storm bolter',
          count: 1,
        },
      ],
      false
    );

    const sbBadge = equipped.find(w => w.name === 'Storm bolter');
    const acBadge = equipped.find(w => w.name === 'Assault Cannon');
    const pfBadge = equipped.find(w => w.name === 'Power fist');

    expect(sbBadge).toBeDefined();
    expect(sbBadge?.count).toBe(4); // 4 remaining Storm bolters
    expect(acBadge).toBeDefined();
    expect(acBadge?.count).toBe(1); // 1 Assault Cannon
    expect(pfBadge).toBeDefined();
    expect(pfBadge?.count).toBe(5); // 5 Power fists
  });
});

describe('Munitorum Field Manual points checking & tier calculation', () => {
  it('correctly calculates points for MFM base tiers and understrength/overstrength scaling', () => {
    // 5-man Terminator Squad at 175 base points
    const res5 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 5, baseModelCount: 5 });
    expect(res5.totalPoints).toBe(175);
    expect(res5.tierMultiplier).toBe(1);
    expect(res5.tierMaxModels).toBe(5);
    expect(res5.isUnderstrength).toBe(false);

    // 6-man squad pays for 10-man tier (2x 175 = 350 pts)
    const res6 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 6, baseModelCount: 5 });
    expect(res6.totalPoints).toBe(350);
    expect(res6.tierMultiplier).toBe(2);
    expect(res6.tierMaxModels).toBe(10);
    expect(res6.isUnderstrength).toBe(true);

    // 10-man squad pays full tier (350 pts)
    const res10 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 10, baseModelCount: 5 });
    expect(res10.totalPoints).toBe(350);
    expect(res10.tierMultiplier).toBe(2);
    expect(res10.tierMaxModels).toBe(10);
    expect(res10.isUnderstrength).toBe(false);

    // Single model character ignores squad scaling
    const char = calculateUnitSquadPoints({ basePoints: 90, modelCount: 1, baseModelCount: 1, isCharacter: true });
    expect(char.totalPoints).toBe(90);
    expect(char.tierMultiplier).toBe(1);
    expect(char.tierMaxModels).toBe(1);
  });

  it('correctly includes MFM enhancement points in unit total points', () => {
    const res = calculateUnitSquadPoints({
      basePoints: 90,
      modelCount: 1,
      baseModelCount: 1,
      isCharacter: true,
      enhancementPoints: 20,
    });
    expect(res.totalPoints).toBe(110);
  });
});

