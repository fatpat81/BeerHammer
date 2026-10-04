// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Database Seed Script
// Populates core stratagems, starter datasheets, weapons, and paint swatches
// ─────────────────────────────────────────────────────────────────────────────

import {
  PrismaClient,
  BattlefieldRole,
  AbilitySource,
  BattlePhase,
  StratagemCategory,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Initiating ForceOrg-40k Database Seed ---');

  // ── Core Stratagems (§6.2) ───────────────────────────────────────────────
  const coreStratagems = [
    { name: 'Command Re-roll', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.ANY, description: 'Re-roll one Hit roll, Wound roll, Damage roll, saving throw, Advance roll, Charge roll, Desperate Escape test, or Hazard test.', requiredKeywords: [] as string[] },
    { name: 'Counter-Offensive', category: StratagemCategory.CORE, cpCost: 2, phase: BattlePhase.FIGHT, description: 'Interrupt the combat sequence immediately after an enemy unit has fought to fight with one eligible unit from your army.', requiredKeywords: [] as string[] },
    { name: 'Rapid Ingress', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.MOVEMENT, description: 'Your unit can arrive from Reserves as if it were the Reinforcements step of your Movement phase, during your opponent\'s turn.', requiredKeywords: ['DEEP STRIKE'] },
    { name: 'Heroic Intervention', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.CHARGE, description: 'Declare a counter-charge with one eligible unit after an enemy unit completes a charge move within 6" of that unit.', requiredKeywords: ['CHARACTER', 'VEHICLE', 'WALKER'] },
    { name: 'Smokescreen', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.SHOOTING, description: 'Target unit gains the Benefit of Cover and the Stealth ability until the end of the phase.', requiredKeywords: ['SMOKE'] },
    { name: 'Tank Shock', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.CHARGE, description: 'Select one enemy unit within Engagement Range after completing a Charge move; roll dice equal to your vehicle toughness and inflict mortal wounds on 5+.', requiredKeywords: ['VEHICLE'] },
    { name: 'Go to Ground', category: StratagemCategory.CORE, cpCost: 1, phase: BattlePhase.SHOOTING, description: 'Target unit gains the Benefit of Cover and a 6+ invulnerable save until the end of the phase.', requiredKeywords: ['INFANTRY'] },
  ];

  for (const strat of coreStratagems) {
    const existing = await prisma.stratagem.findFirst({ where: { name: strat.name, category: strat.category } });
    if (!existing) await prisma.stratagem.create({ data: strat });
  }
  console.log(`  ✓ Core Stratagems: ${coreStratagems.length} seeded`);

  // ── Paint Swatches ─────────────────────────────────────────────────────────
  const paintSwatches = [
    { brand: 'Citadel', paintName: 'Macragge Blue', paintType: 'Base', hexCode: '#0B3056', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'Retributor Armour', paintType: 'Base', hexCode: '#C89D3C', finish: 'Metallic' },
    { brand: 'Citadel', paintName: 'Leadbelcher', paintType: 'Base', hexCode: '#888D8F', finish: 'Metallic' },
    { brand: 'Citadel', paintName: 'Mephiston Red', paintType: 'Base', hexCode: '#991B1B', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'Caliban Green', paintType: 'Base', hexCode: '#143823', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'The Fang', paintType: 'Base', hexCode: '#5C768D', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'Abaddon Black', paintType: 'Base', hexCode: '#090A0C', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'Averland Sunset', paintType: 'Base', hexCode: '#D97706', finish: 'Matte' },
    { brand: 'Citadel', paintName: 'Nuln Oil', paintType: 'Shade', hexCode: '#141414', finish: 'Gloss' },
    { brand: 'Citadel', paintName: 'Tesseract Glow', paintType: 'Technical', hexCode: '#22C55E', finish: 'Gloss' },
    { brand: 'Vallejo', paintName: 'Imperial Blue', paintType: 'Base', hexCode: '#092744', finish: 'Matte' },
    { brand: 'Vallejo', paintName: 'Glorious Gold', paintType: 'Base', hexCode: '#C59733', finish: 'Metallic' },
    { brand: 'Pro Acryl', paintName: 'Bold Titanium White', paintType: 'Base', hexCode: '#F8FAFC', finish: 'Matte' },
    { brand: 'Pro Acryl', paintName: 'Rich Gold', paintType: 'Base', hexCode: '#D4AF37', finish: 'Metallic' },
  ];

  for (const swatch of paintSwatches) {
    const existing = await prisma.paintSwatch.findFirst({ where: { brand: swatch.brand, paintName: swatch.paintName } });
    if (!existing) await prisma.paintSwatch.create({ data: swatch });
  }
  console.log(`  ✓ Paint Swatches: ${paintSwatches.length} seeded`);

  // ── Weapons Registry ───────────────────────────────────────────────────────
  const weapons = [
    { slug: 'wep_storm_bolter', name: 'Storm Bolter', type: 'Ranged', range: '24"', attacks: '2', skill: '3+', strength: 4, armorPenetration: 0, damage: '1', firingMode: 'Standard', keywords: ['RAPID FIRE 2'] },
    { slug: 'wep_power_fist', name: 'Power Fist', type: 'Melee', range: 'Melee', attacks: '3', skill: '3+', strength: 8, armorPenetration: 2, damage: '2', firingMode: 'Standard', keywords: [] as string[] },
    { slug: 'wep_master_crafted_power_weapon', name: 'Master-crafted Power Weapon', type: 'Melee', range: 'Melee', attacks: '6', skill: '2+', strength: 5, armorPenetration: 2, damage: '2', firingMode: 'Precision', keywords: [] as string[] },
    { slug: 'wep_assault_cannon', name: 'Assault Cannon', type: 'Ranged', range: '24"', attacks: '6', skill: '3+', strength: 6, armorPenetration: 1, damage: '1', firingMode: 'Saturation', keywords: ['DEVASTATING WOUNDS'] },
    { slug: 'wep_heavy_flamer', name: 'Heavy Flamer', type: 'Ranged', range: '12"', attacks: 'D6', skill: 'N/A', strength: 5, armorPenetration: 1, damage: '1', firingMode: 'Saturation', keywords: ['TORRENT', 'IGNORES COVER'] },
    { slug: 'wep_gauss_flayer', name: 'Gauss Flayer', type: 'Ranged', range: '24"', attacks: '1', skill: '4+', strength: 4, armorPenetration: 0, damage: '1', firingMode: 'Standard', keywords: ['LETHAL HITS', 'RAPID FIRE 1'] },
    { slug: 'wep_hyperphase_blade', name: 'Hyperphase Blade', type: 'Melee', range: 'Melee', attacks: '4', skill: '2+', strength: 6, armorPenetration: 2, damage: '2', firingMode: 'Standard', keywords: [] as string[] },
    { slug: 'wep_tachyon_arrow', name: 'Tachyon Arrow', type: 'Ranged', range: '72"', attacks: '1', skill: '2+', strength: 16, armorPenetration: 5, damage: 'D6+2', firingMode: 'Precision', keywords: ['ONE SHOT'] },
    { slug: 'wep_bolt_rifle', name: 'Bolt Rifle', type: 'Ranged', range: '24"', attacks: '2', skill: '3+', strength: 4, armorPenetration: 1, damage: '1', firingMode: 'Standard', keywords: ['ASSAULT', 'HEAVY'] },
    { slug: 'wep_astartes_chainsword', name: 'Astartes Chainsword', type: 'Melee', range: 'Melee', attacks: '4', skill: '3+', strength: 4, armorPenetration: 1, damage: '1', firingMode: 'Standard', keywords: [] as string[] },
    { slug: 'wep_plasma_pistol', name: 'Plasma Pistol', type: 'Ranged', range: '12"', attacks: '1', skill: '3+', strength: 7, armorPenetration: 2, damage: '1', firingMode: 'Standard', keywords: ['PISTOL', 'HAZARDOUS'] },
  ];

  const weaponRecords: Record<string, any> = {};
  for (const wep of weapons) {
    weaponRecords[wep.slug] = await prisma.weapon.upsert({ where: { slug: wep.slug }, update: wep, create: wep });
  }
  console.log(`  ✓ Weapons: ${weapons.length} seeded`);

  // ── Space Marine Datasheets ────────────────────────────────────────────────
  const captainTerminator = await prisma.datasheet.upsert({
    where: { id: '11111111-1111-4000-8000-000000000001' },
    update: {},
    create: {
      id: '11111111-1111-4000-8000-000000000001',
      factionId: 'adeptus_astartes',
      name: 'Captain in Terminator Armour',
      battlefieldRole: BattlefieldRole.CHARACTER,
      basePoints: 95,
      unitComposition: { models: [{ name: 'Captain in Terminator Armour', count: 1, baseSize: '50mm' }] },
      stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
      keywords: ['INFANTRY', 'CHARACTER', 'EPIC HERO', 'IMPERIUM', 'TERMINATOR', 'CAPTAIN'],
      canonicalImageUrl: '/assets/models/space_marines/captain_terminator.webp',
      canonicalThumbUrl: '/assets/models/space_marines/captain_terminator_thumb.webp',
    },
  });

  const terminatorSquad = await prisma.datasheet.upsert({
    where: { id: '11111111-1111-4000-8000-000000000002' },
    update: {},
    create: {
      id: '11111111-1111-4000-8000-000000000002',
      factionId: 'adeptus_astartes',
      name: 'Terminator Squad',
      battlefieldRole: BattlefieldRole.INFANTRY,
      basePoints: 185,
      unitComposition: { models: [{ name: 'Terminator Sergeant', min: 1, max: 1, baseSize: '40mm' }, { name: 'Terminator', min: 4, max: 9, baseSize: '40mm' }] },
      stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
      keywords: ['INFANTRY', 'IMPERIUM', 'TERMINATOR'],
      canonicalImageUrl: '/assets/models/space_marines/terminator_squad.webp',
      canonicalThumbUrl: '/assets/models/space_marines/terminator_squad_thumb.webp',
    },
  });

  const intercessorSquad = await prisma.datasheet.upsert({
    where: { id: '11111111-1111-4000-8000-000000000003' },
    update: {},
    create: {
      id: '11111111-1111-4000-8000-000000000003',
      factionId: 'adeptus_astartes',
      name: 'Intercessor Squad',
      battlefieldRole: BattlefieldRole.BATTLELINE,
      basePoints: 75,
      unitComposition: { models: [{ name: 'Intercessor Sergeant', min: 1, max: 1, baseSize: '32mm' }, { name: 'Intercessor', min: 4, max: 9, baseSize: '32mm' }] },
      stats: { movement: '6"', toughness: 4, save: '3+', leadership: '6+', objectiveControl: 2 },
      keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS', 'INTERCESSOR'],
      canonicalImageUrl: '/assets/models/space_marines/intercessor_squad.webp',
      canonicalThumbUrl: '/assets/models/space_marines/intercessor_squad_thumb.webp',
    },
  });

  // ── Necron Datasheets ──────────────────────────────────────────────────────
  const overlord = await prisma.datasheet.upsert({
    where: { id: '22222222-2222-4000-8000-000000000001' },
    update: {},
    create: {
      id: '22222222-2222-4000-8000-000000000001',
      factionId: 'necrons',
      name: 'Overlord',
      battlefieldRole: BattlefieldRole.CHARACTER,
      basePoints: 85,
      unitComposition: { models: [{ name: 'Overlord', count: 1, baseSize: '40mm' }] },
      stats: { movement: '6"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
      keywords: ['INFANTRY', 'CHARACTER', 'NOBLE', 'NECRONS', 'OVERLORD'],
      canonicalImageUrl: '/assets/models/necrons/overlord.webp',
      canonicalThumbUrl: '/assets/models/necrons/overlord_thumb.webp',
    },
  });

  const warriors = await prisma.datasheet.upsert({
    where: { id: '22222222-2222-4000-8000-000000000002' },
    update: {},
    create: {
      id: '22222222-2222-4000-8000-000000000002',
      factionId: 'necrons',
      name: 'Necron Warriors',
      battlefieldRole: BattlefieldRole.BATTLELINE,
      basePoints: 100,
      unitComposition: { models: [{ name: 'Necron Warrior', min: 10, max: 20, baseSize: '32mm' }] },
      stats: { movement: '5"', toughness: 4, save: '4+', leadership: '7+', objectiveControl: 2 },
      keywords: ['INFANTRY', 'BATTLELINE', 'NECRONS', 'WARRIOR'],
      canonicalImageUrl: '/assets/models/necrons/necron_warriors.webp',
      canonicalThumbUrl: '/assets/models/necrons/necron_warriors_thumb.webp',
    },
  });

  console.log('  ✓ Datasheets: Space Marines & Necrons seeded');

  // ── Leader Compatibility ───────────────────────────────────────────────────
  await prisma.leaderCompatibility.upsert({
    where: { leaderDatasheetId_bodyguardDatasheetId: { leaderDatasheetId: captainTerminator.id, bodyguardDatasheetId: terminatorSquad.id } },
    update: {},
    create: { leaderDatasheetId: captainTerminator.id, bodyguardDatasheetId: terminatorSquad.id },
  });

  await prisma.leaderCompatibility.upsert({
    where: { leaderDatasheetId_bodyguardDatasheetId: { leaderDatasheetId: overlord.id, bodyguardDatasheetId: warriors.id } },
    update: {},
    create: { leaderDatasheetId: overlord.id, bodyguardDatasheetId: warriors.id },
  });
  console.log('  ✓ Leader Compatibility links seeded');

  // ── Weapon → Datasheet Links ───────────────────────────────────────────────
  const weaponLinks = [
    { datasheetId: captainTerminator.id, slug: 'wep_storm_bolter' },
    { datasheetId: captainTerminator.id, slug: 'wep_master_crafted_power_weapon' },
    { datasheetId: terminatorSquad.id, slug: 'wep_storm_bolter' },
    { datasheetId: terminatorSquad.id, slug: 'wep_power_fist' },
    { datasheetId: terminatorSquad.id, slug: 'wep_assault_cannon' },
    { datasheetId: terminatorSquad.id, slug: 'wep_heavy_flamer' },
    { datasheetId: intercessorSquad.id, slug: 'wep_bolt_rifle' },
    { datasheetId: intercessorSquad.id, slug: 'wep_astartes_chainsword' },
    { datasheetId: intercessorSquad.id, slug: 'wep_plasma_pistol' },
    { datasheetId: overlord.id, slug: 'wep_tachyon_arrow' },
    { datasheetId: overlord.id, slug: 'wep_hyperphase_blade' },
    { datasheetId: warriors.id, slug: 'wep_gauss_flayer' },
  ];

  for (const link of weaponLinks) {
    const weaponRecord = weaponRecords[link.slug];
    if (!weaponRecord) continue;
    await prisma.datasheetWeapon.upsert({
      where: { datasheetId_weaponId: { datasheetId: link.datasheetId, weaponId: weaponRecord.id } },
      update: {},
      create: { datasheetId: link.datasheetId, weaponId: weaponRecord.id, isDefault: true },
    });
  }
  console.log('  ✓ Datasheet ↔ Weapon links seeded');

  // ── Abilities ──────────────────────────────────────────────────────────────
  const abilities = [
    { datasheetId: captainTerminator.id, name: 'Rites of Battle', source: AbilitySource.LEADER, phase: BattlePhase.ANY, description: 'Once per battle round, one unit from your army with this ability can target this unit with a Stratagem for 0 CP.' },
    { datasheetId: captainTerminator.id, name: 'Iron Resolve', source: AbilitySource.CORE, phase: BattlePhase.ANY, description: 'This model has a 4+ invulnerable save.' },
    { datasheetId: terminatorSquad.id, name: 'Fury of the First', source: AbilitySource.BODYGUARD, phase: BattlePhase.FIGHT, description: 'Each time a model in this unit makes a melee attack, you can re-roll a Wound roll of 1.' },
    { datasheetId: overlord.id, name: 'Relentless March', source: AbilitySource.LEADER, phase: BattlePhase.COMMAND, description: 'While this model is leading a unit, each time a model in that unit makes a ranged attack, add 1 to the Hit roll.' },
    { datasheetId: warriors.id, name: 'Reanimation Protocols', source: AbilitySource.CORE, phase: BattlePhase.COMMAND, description: 'At the start of your Command phase, roll one D6 for each wound allocated to models in this unit; for each 5+, heal one wound.' },
  ];

  for (const ability of abilities) {
    const existing = await prisma.ability.findFirst({ where: { datasheetId: ability.datasheetId, name: ability.name } });
    if (!existing) await prisma.ability.create({ data: ability });
  }
  console.log('  ✓ Abilities seeded');

  console.log('--- ForceOrg-40k Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
