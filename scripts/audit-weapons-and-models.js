const fs = require('fs');
const path = require('path');

const bsDir = path.join(__dirname, '../data/bsdata');
const factionsDir = path.join(__dirname, '../data/factions');

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

console.log('Indexing BSData catalogues...');
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

const factionFiles = fs.readdirSync(factionsDir).filter(f => f.endsWith('.json') && f !== 'index.json');

let missingWeaponsCount = 0;
let unitsWithNewWeapons = 0;
const unitsToReport = [];

factionFiles.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join(factionsDir, f), 'utf8'));
  (data.datasheets || []).forEach(ds => {
    const entry = globalEntryMap.get(ds.id);
    if (!entry) return;
    const bsWeapons = scanWeapons(entry);
    const existingNames = new Set((ds.weapons || []).map(w => w.name.toLowerCase().trim()));
    const missing = [];
    bsWeapons.forEach(bw => {
      const bwn = bw.name.toLowerCase().trim();
      if (!existingNames.has(bwn)) {
        missing.push(bw);
        existingNames.add(bwn);
      }
    });

    if (missing.length > 0) {
      unitsWithNewWeapons++;
      missingWeaponsCount += missing.length;
      unitsToReport.push({
        faction: f,
        name: ds.name,
        existingCount: ds.weapons?.length || 0,
        missing
      });
    }
  });
});

console.log(`\nTotal units with missing BSData weapons: ${unitsWithNewWeapons}`);
console.log(`Total missing weapons identified: ${missingWeaponsCount}\n`);

unitsToReport.slice(0, 20).forEach(u => {
  console.log(`[${u.faction}] ${u.name} (had ${u.existingCount} weapons, +${u.missing.length} missing):`);
  console.log('   Missing: ' + u.missing.map(m => m.name).join(', '));
});
