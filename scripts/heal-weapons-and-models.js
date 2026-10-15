const fs = require('fs');
const path = require('path');

const bsDir = path.join(__dirname, '../data/bsdata');
const factionsDir = path.join(__dirname, '../data/factions');
const webFactionsDir = path.join(__dirname, '../apps/web/public/data/factions');

const globalProfileMap = new Map();
const globalEntryMap = new Map();

function indexCatalogue(node) {
  if (!node || typeof node !== 'object') return;
  if (node.id) {
    if (node.profiles && Array.isArray(node.profiles)) {
      for (const p of node.profiles) globalProfileMap.set(p.id, p);
    }
    if (node.typeName) {
      globalProfileMap.set(node.id, node);
    }
    globalEntryMap.set(node.id, node);
  }
  for (const k of Object.keys(node)) {
    if (Array.isArray(node[k])) {
      for (const c of node[k]) indexCatalogue(c);
    }
  }
}

console.log('1. Indexing BSData catalogues...');
fs.readdirSync(bsDir).filter(f => f.endsWith('.json')).forEach(f => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(bsDir, f), 'utf8'));
    if (raw && raw.catalogue) indexCatalogue(raw.catalogue);
    if (raw && raw.gameSystem) indexCatalogue(raw.gameSystem);
  } catch (e) {}
});

console.log(`Indexed ${globalProfileMap.size} profiles and ${globalEntryMap.size} entries.`);

function parseCharacteristics(chars) {
  const map = {};
  if (!chars || !Array.isArray(chars)) return map;
  for (const c of chars) {
    if (c.name && c['$text'] !== undefined) {
      map[c.name.trim()] = c['$text'].trim();
    }
  }
  return map;
}

function scanWeapons(node, visited = new Set(), results = []) {
  if (!node || typeof node !== 'object' || visited.has(node)) return results;
  visited.add(node);
  if (/^(crusade|enhancements?|crusade.*points)$/i.test((node.name || '').trim())) return results;

  if (node.targetId) {
    const target = globalEntryMap.get(node.targetId) || globalProfileMap.get(node.targetId);
    if (target) scanWeapons(target, visited, results);
  }

  if (node.profiles && Array.isArray(node.profiles)) {
    for (const p of node.profiles) {
      if (p.typeName === 'Ranged Weapons' || p.typeName === 'Melee Weapons') {
        const chars = parseCharacteristics(p.characteristics);
        const isRanged = p.typeName === 'Ranged Weapons';
        results.push({
          name: p.name,
          type: isRanged ? 'Ranged' : 'Melee',
          range: chars.Range || (isRanged ? '24"' : 'Melee'),
          attacks: chars.A || '1',
          skill: (isRanged ? chars.BS : chars.WS) || '3+',
          strength: parseInt(chars.S, 10) || 4,
          armorPenetration: parseInt(chars.AP, 10) || 0,
          damage: chars.D || '1',
          keywords: (chars.Keywords || '').split(',').map(s => s.trim()).filter(Boolean)
        });
      }
    }
  }

  for (const key of ['selectionEntries', 'selectionEntryGroups', 'entryLinks', 'infoLinks']) {
    if (node[key] && Array.isArray(node[key])) {
      for (const child of node[key]) {
        scanWeapons(child, visited, results);
      }
    }
  }

  return results;
}

function getUnitThreshold(unit) {
  const lowerName = (unit.name || '').toLowerCase();
  const rawKeywords = (unit.keywords || []).map(k => (k || '').toLowerCase());
  const role = (unit.battlefieldRole || '').toUpperCase();

  // 1. Explicit multi-model character retinues & fixed unique squads
  if (/company heroes/i.test(lowerName)) return 4;
  if (/grimaldus/i.test(lowerName)) return 4;
  if (/calgar/i.test(lowerName)) return 3;
  if (/celestine/i.test(lowerName)) return 3;
  if (/gaunt.*ghost/i.test(lowerName)) return 6;
  if (/kill team cassius/i.test(lowerName)) return 11;
  if (/rogue trader entourage/i.test(lowerName)) return 4;
  if (/accursed cultist/i.test(lowerName)) return 8;
  if (/neurogaunt/i.test(lowerName)) return 11;
  if (/crusader squad/i.test(lowerName) && !/legends/i.test(lowerName)) return 10;
  if (/aestred thurga/i.test(lowerName)) return 2;
  if (/daemonifuge/i.test(lowerName)) return 2;
  if (/rein and raus/i.test(lowerName)) return 2;
  if (/deathwatch.*kill team|indomitor kill team|fortis kill team|spectrus kill team|proteus kill team/i.test(lowerName)) return 5;

  // 2. Single-model units: Characters, Epic Heroes, Vehicles, Monsters, Walkers, Fortifications
  const isChar =
    role === 'CHARACTER' ||
    rawKeywords.some(k => k.includes('character') || k.includes('epic hero'));
  if (isChar) return 1;

  const isInfantry = role === 'INFANTRY' || role === 'BATTLELINE' || rawKeywords.some(k => k.includes('infantry') || k.includes('battleline'));

  const isVehicleOrMonster =
    !isInfantry &&
    (role === 'VEHICLE' ||
    role === 'MONSTER' ||
    role === 'FORTIFICATION' ||
    rawKeywords.some(
      k =>
        k.includes('vehicle') ||
        k.includes('monster') ||
        (k.includes('walker') && !k.includes('poxwalker')) ||
        k.includes('fortification') ||
        k.includes('titanic') ||
        k.includes('aircraft')
    ));

  const isSquadron = /broadside|armiger|war dog|tarantula|land speeder/i.test(lowerName);
  if (isVehicleOrMonster && !isSquadron) return 1;

  // 3. Horde / Swarm / 10-man units (10 models baseline)
  if (
    /cultist mob|cultist|boyz|beast snagga|gretchin|grots|shock troop|infantry squad|catachan|krieg|jungle fighter|poxwalker|termagant|hormagaunt|gargoyle|bloodletter|daemonette|plaguebearer|pink horror|blue horror|kroot carnivore|skitarii|kabalite|wyche|fire warrior|breacher|strike team|necron warrior|jakhal|tzaangor|hearthkyn|battle sister|guardian defender|storm guardian|tactical squad|blood claw|grey hunter/i.test(
      lowerName
    )
  ) {
    return 10;
  }

  // 4. Custodes Guard / Wardens (4 models baseline)
  if (/custodian guard|custodian warden/i.test(lowerName)) {
    return 4;
  }

  // 5. Elite 3-model squads (3 models baseline)
  if (
    /aggressor|eradicator|bladeguard|inceptor|suppressor|eliminator|centurion|eightbound|deathshroud|allarus|crisis|broadside|stealth|wraithguard|wraithblade|squighog|meganob|paragon warsuit|tyranid warrior|zoanthrope|venomthrope|hive guard|tyrant guard|ravener|von ryan|skorpekh|ophydian|tomb blade|lokhust|windrider|shining spear|skyweaver|biker|outrider|ogryn|bullgryn|kataphron/i.test(
      lowerName
    )
  ) {
    return 3;
  }

  // 6. Terminators (5 models baseline)
  if (/terminator/i.test(lowerName)) {
    return 5;
  }

  // 7. Standard Infantry & Battleline squads (5 models baseline)
  if (
    /intercessor|infernus|infiltrator|incursor|scout|legionar|chosen|havoc|retributor|sister|dominion|celestian|seraphim|zephyrim|repentia|raptor|warp talon|rubric|plague marine|immortal|deathmark|lychguard|praetorian|sternguard|vanguard|hellblaster|desolation|reiver|hearthguard|pteraxii|ruststalker|sicarian|avenger|scorpion|banshee|dragon|hawk|spider|reaper|wrack|mandrake|incubi|aberrant|genestealer|metamorph|hybrid/i.test(
      lowerName
    ) ||
    rawKeywords.some(
      k =>
        k.includes('infantry') ||
        k.includes('battleline') ||
        k.includes('mounted') ||
        k.includes('jump pack')
    )
  ) {
    return 5;
  }

  return 1;
}

// Canonical fallback profiles for known special cases
const CANONICAL_FALLBACKS = {
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
  }
};

const dirs = [factionsDir, webFactionsDir];
let totalWeaponsAdded = 0;
let totalUnitsHealed = 0;
let totalModelsFixed = 0;

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');

  files.forEach(f => {
    const filePath = path.join(dir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return;
    }

    let modified = false;

    (data.datasheets || []).forEach(ds => {
      // 1. Heal weapons from BSData
      ds.weapons = ds.weapons || [];
      const entry = globalEntryMap.get(ds.id);
      if (entry) {
        const bsWeapons = scanWeapons(entry);
        const existingNames = new Set(ds.weapons.map(w => w.name.toLowerCase().trim()));
        bsWeapons.forEach(bw => {
          const bwn = bw.name.toLowerCase().trim();
          if (!existingNames.has(bwn)) {
            ds.weapons.push(bw);
            existingNames.add(bwn);
            modified = true;
            totalWeaponsAdded++;
          }
        });
      }

      // Handle specific units like Drop Pod
      if (ds.name.toLowerCase().includes('drop pod') && !ds.weapons.some(w => w.name.toLowerCase().includes('storm bolter'))) {
        ds.weapons.push({ ...CANONICAL_FALLBACKS.stormBolter });
        modified = true;
      }
      if (ds.name.toLowerCase().includes('crusaders [legends]') && ds.weapons.length === 0) {
        ds.weapons.push({ ...CANONICAL_FALLBACKS.powerWeapon });
        ds.weapons.push({ ...CANONICAL_FALLBACKS.closeCombatWeapon });
        modified = true;
      }

      // 2. Fix model counts in unitComposition
      const threshold = getUnitThreshold(ds);
      ds.unitComposition = ds.unitComposition || { models: [{ name: ds.name, baseSize: '32mm', count: threshold }] };
      if (!Array.isArray(ds.unitComposition.models) || ds.unitComposition.models.length === 0) {
        ds.unitComposition.models = [{ name: ds.name, baseSize: '32mm', count: threshold }];
        modified = true;
        totalModelsFixed++;
      } else {
        const compSum = ds.unitComposition.models.reduce((sum, m) => sum + (m.count || 1), 0);
        if (compSum < threshold) {
          // Adjust the last model (the rank-and-file trooper) to meet the threshold
          const lastModel = ds.unitComposition.models[ds.unitComposition.models.length - 1];
          lastModel.count = (lastModel.count || 1) + (threshold - compSum);
          modified = true;
          totalModelsFixed++;
        }
      }

      if (modified) totalUnitsHealed++;
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
  });
});

console.log(`\nSuccessfully healed datasheets!`);
console.log(`- Total weapons added: ${totalWeaponsAdded}`);
console.log(`- Total model compositions updated: ${totalModelsFixed}`);
