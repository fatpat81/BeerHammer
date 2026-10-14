const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, '../apps/web/public/data/factions'),
  path.join(__dirname, '../data/factions')
];

// Standard weapon profiles to ensure complete profiles
const CANONICAL_WEAPONS = {
  stormBolter: {
    name: 'Storm bolter',
    type: 'Ranged',
    range: '24"',
    attacks: '2',
    skill: '3+',
    strength: 4,
    armorPenetration: 0,
    damage: '1',
    keywords: ['Rapid Fire 2']
  },
  combiBolter: {
    name: 'Combi-bolter',
    type: 'Ranged',
    range: '24"',
    attacks: '2',
    skill: '3+',
    strength: 5,
    armorPenetration: -1,
    damage: '1',
    keywords: ['Rapid Fire 2']
  },
  combiWeapon: {
    name: 'Combi-weapon',
    type: 'Ranged',
    range: '24"',
    attacks: '1',
    skill: '4+',
    strength: 5,
    armorPenetration: -1,
    damage: '1',
    keywords: ['Anti-INFANTRY 4+', 'Devastating Wounds', 'Rapid Fire 1']
  },
  assaultCannon: {
    name: 'Assault Cannon',
    type: 'Ranged',
    range: '24"',
    attacks: '6',
    skill: '3+',
    strength: 6,
    armorPenetration: 0,
    damage: '1',
    keywords: ['Devastating Wounds']
  },
  heavyFlamer: {
    name: 'Heavy Flamer',
    type: 'Ranged',
    range: '12"',
    attacks: 'D6',
    skill: 'N/A',
    strength: 5,
    armorPenetration: -1,
    damage: '1',
    keywords: ['Ignores Cover', 'Torrent']
  },
  cycloneFrag: {
    name: '➤ Cyclone missile launcher - frag',
    type: 'Ranged',
    range: '36"',
    attacks: '2D6',
    skill: '3+',
    strength: 4,
    armorPenetration: 0,
    damage: '1',
    keywords: ['Blast']
  },
  cycloneKrak: {
    name: '➤ Cyclone missile launcher - krak',
    type: 'Ranged',
    range: '36"',
    attacks: '2',
    skill: '3+',
    strength: 9,
    armorPenetration: -2,
    damage: 'D6',
    keywords: []
  },
  reaperAutocannon: {
    name: 'Reaper autocannon',
    type: 'Ranged',
    range: '36"',
    attacks: '4',
    skill: '3+',
    strength: 7,
    armorPenetration: -1,
    damage: '1',
    keywords: ['Devastating Wounds', 'Sustained Hits 1']
  },
  plasmaCannonStandard: {
    name: '➤ Plasma cannon - standard',
    type: 'Ranged',
    range: '36"',
    attacks: 'D3',
    skill: '3+',
    strength: 7,
    armorPenetration: -2,
    damage: '1',
    keywords: ['Blast']
  },
  plasmaCannonSupercharge: {
    name: '➤ Plasma cannon - supercharge',
    type: 'Ranged',
    range: '36"',
    attacks: 'D3',
    skill: '3+',
    strength: 8,
    armorPenetration: -3,
    damage: '2',
    keywords: ['Blast', 'Hazardous']
  },
  powerFist: {
    name: 'Power fist',
    type: 'Melee',
    range: 'Melee',
    attacks: '3',
    skill: '3+',
    strength: 8,
    armorPenetration: -2,
    damage: '2',
    keywords: []
  },
  chainfist: {
    name: 'Chainfist',
    type: 'Melee',
    range: 'Melee',
    attacks: '3',
    skill: '4+',
    strength: 8,
    armorPenetration: -2,
    damage: '2',
    keywords: ['Anti-Vehicle 3+']
  },
  powerWeapon: {
    name: 'Power weapon',
    type: 'Melee',
    range: 'Melee',
    attacks: '4',
    skill: '3+',
    strength: 5,
    armorPenetration: -2,
    damage: '1',
    keywords: []
  },
  closeCombatWeapon: {
    name: 'Close combat weapon',
    type: 'Melee',
    range: 'Melee',
    attacks: '3',
    skill: '3+',
    strength: 4,
    armorPenetration: 0,
    damage: '1',
    keywords: []
  },
  hurricaneBolter: {
    name: 'Hurricane bolter',
    type: 'Ranged',
    range: '24"',
    attacks: '6',
    skill: '3+',
    strength: 4,
    armorPenetration: 0,
    damage: '1',
    keywords: ['Rapid Fire 6', 'Twin-linked']
  },
  twinAssaultCannon: {
    name: 'Twin assault cannon',
    type: 'Ranged',
    range: '24"',
    attacks: '6',
    skill: '3+',
    strength: 6,
    armorPenetration: 0,
    damage: '1',
    keywords: ['Devastating Wounds', 'Twin-linked']
  },
  multiMelta: {
    name: 'Multi-melta',
    type: 'Ranged',
    range: '18"',
    attacks: '2',
    skill: '3+',
    strength: 9,
    armorPenetration: -4,
    damage: 'D6',
    keywords: ['Melta 2']
  },
  hunterKillerMissile: {
    name: 'Hunter-killer missile',
    type: 'Ranged',
    range: '48"',
    attacks: '1',
    skill: '2+',
    strength: 14,
    armorPenetration: -3,
    damage: 'D6',
    keywords: ['One Shot']
  },
  armouredTracks: {
    name: 'Armoured Tracks',
    type: 'Melee',
    range: 'Melee',
    attacks: '6',
    skill: '4+',
    strength: 8,
    armorPenetration: 0,
    damage: '1',
    keywords: []
  }
};

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');

  // Build lookup index of weapons by unit name across all files in this directory
  const unitWeaponsMap = new Map();
  files.forEach(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      (data.datasheets || []).forEach(d => {
        if (d.weapons && d.weapons.length > 0) {
          const key = d.name.toLowerCase().trim();
          if (!unitWeaponsMap.has(key) || unitWeaponsMap.get(key).length < d.weapons.length) {
            unitWeaponsMap.set(key, d.weapons);
          }
        }
      });
    } catch (e) {}
  });

  console.log(`[${dir}] Indexed ${unitWeaponsMap.size} base unit profiles.`);

  let totalUpdated = 0;

  files.forEach(f => {
    const filePath = path.join(dir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      return;
    }

    let modified = false;

    (data.datasheets || []).forEach(u => {
      const uName = u.name.trim();
      const uNameLower = uName.toLowerCase();
      u.weapons = u.weapons || [];

      // 1. Check if this is a Terminator unit
      if (uNameLower.includes('terminator')) {
        const isChaos = f.includes('chaos') || (u.keywords || []).some(k => k.includes('CHAOS') || k.includes('HERETIC'));
        const isGreyKnights = f.includes('grey-knights') || uNameLower.includes('grey knight');
        const isThousandSons = f.includes('thousand-sons');
        const isDarkAngels = f.includes('dark-angels') || uNameLower.includes('deathwing');
        const isCustodes = uNameLower.includes('allarus') || f.includes('custodes');

        if (!isCustodes) {
          const existingNames = new Set(u.weapons.map(w => w.name.toLowerCase().trim()));

          // Ensure primary bolter
          if (isChaos) {
            if (!existingNames.has('combi-bolter')) {
              u.weapons.unshift({ ...CANONICAL_WEAPONS.combiBolter });
              existingNames.add('combi-bolter');
              modified = true;
            }
            if (!existingNames.has('combi-weapon')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.combiWeapon });
              existingNames.add('combi-weapon');
              modified = true;
            }
            if (!existingNames.has('heavy flamer')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.heavyFlamer });
              existingNames.add('heavy flamer');
              modified = true;
            }
            if (!existingNames.has('reaper autocannon')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.reaperAutocannon });
              existingNames.add('reaper autocannon');
              modified = true;
            }
            if (!existingNames.has('power fist')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.powerFist });
              existingNames.add('power fist');
              modified = true;
            }
            if (!existingNames.has('chainfist')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.chainfist });
              existingNames.add('chainfist');
              modified = true;
            }
          } else if (isGreyKnights) {
            if (!existingNames.has('storm bolter')) {
              u.weapons.unshift({ ...CANONICAL_WEAPONS.stormBolter });
              existingNames.add('storm bolter');
              modified = true;
            }
          } else {
            // Space Marines / Imperial Terminators
            if (!existingNames.has('storm bolter')) {
              u.weapons.unshift({ ...CANONICAL_WEAPONS.stormBolter });
              existingNames.add('storm bolter');
              modified = true;
            }
            if (!existingNames.has('assault cannon')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.assaultCannon });
              existingNames.add('assault cannon');
              modified = true;
            }
            if (!existingNames.has('heavy flamer')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.heavyFlamer });
              existingNames.add('heavy flamer');
              modified = true;
            }
            if (![...existingNames].some(n => n.includes('cyclone missile launcher'))) {
              u.weapons.push({ ...CANONICAL_WEAPONS.cycloneFrag });
              u.weapons.push({ ...CANONICAL_WEAPONS.cycloneKrak });
              modified = true;
            }
            if (!existingNames.has('power fist')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.powerFist });
              existingNames.add('power fist');
              modified = true;
            }
            if (!existingNames.has('chainfist')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.chainfist });
              existingNames.add('chainfist');
              modified = true;
            }
            if (!existingNames.has('power weapon')) {
              u.weapons.push({ ...CANONICAL_WEAPONS.powerWeapon });
              existingNames.add('power weapon');
              modified = true;
            }
            if (isDarkAngels) {
              if (![...existingNames].some(n => n.includes('plasma cannon'))) {
                u.weapons.push({ ...CANONICAL_WEAPONS.plasmaCannonStandard });
                u.weapons.push({ ...CANONICAL_WEAPONS.plasmaCannonSupercharge });
                modified = true;
              }
            }
          }
        }
      }

      // 2. Check Land Raider Crusader
      if (uNameLower.includes('land raider crusader') && u.weapons.length === 0) {
        u.weapons = [
          { ...CANONICAL_WEAPONS.hurricaneBolter },
          { ...CANONICAL_WEAPONS.twinAssaultCannon },
          { ...CANONICAL_WEAPONS.multiMelta },
          { ...CANONICAL_WEAPONS.stormBolter },
          { ...CANONICAL_WEAPONS.hunterKillerMissile },
          { ...CANONICAL_WEAPONS.armouredTracks }
        ];
        modified = true;
      }

      // 3. Fallback inheritance: if a unit has 0 weapons or missing ranged/melee, check canonical base index
      if (u.weapons.length === 0 && unitWeaponsMap.has(uNameLower)) {
        u.weapons = JSON.parse(JSON.stringify(unitWeaponsMap.get(uNameLower)));
        modified = true;
      }

      // Check without chapter prefix, e.g. "Deathwatch Veteran" -> "Veteran Squad", "Black Templars Gladiator Lancer" -> "Gladiator Lancer"
      const cleanName = uNameLower
        .replace(/^(black templars|deathwatch|blood angels|space wolves|dark angels|grey knights|ultramarines)\s+/i, '')
        .trim();
      if (u.weapons.length === 0 && unitWeaponsMap.has(cleanName)) {
        u.weapons = JSON.parse(JSON.stringify(unitWeaponsMap.get(cleanName)));
        modified = true;
      }

      // If unit still has no melee weapons and is infantry/character/monster/vehicle, add standard Close combat weapon
      const hasMelee = u.weapons.some(w => w.type === 'Melee' || w.range === 'Melee');
      if (!hasMelee && u.weapons.length > 0 && !uNameLower.includes('drop pod') && !uNameLower.includes('defence')) {
        u.weapons.push({ ...CANONICAL_WEAPONS.closeCombatWeapon });
        modified = true;
      }

      if (modified) totalUpdated++;
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Updated ${f} with healed weapons.`);
    }
  });

  console.log(`[${dir}] Healed ${totalUpdated} datasheets with complete weapons.`);
});
