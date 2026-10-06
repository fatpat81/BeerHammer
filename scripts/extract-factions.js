const fs = require('fs');
const path = require('path');

const bsDir = path.join(__dirname, '../data/bsdata');
const outDir = path.join(__dirname, '../data/factions');
const webDataDir = path.join(__dirname, '../apps/web/public/data/factions');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(webDataDir)) fs.mkdirSync(webDataDir, { recursive: true });

const files = fs.readdirSync(bsDir).filter(f => f.endsWith('.json') && f !== 'Warhammer 40,000.json');

console.log(`Processing ${files.length} faction catalogues...`);

// Core stratagems standard to 11th Edition
const CORE_STRATAGEMS = [
  { id: 'core-command-reroll', name: 'Command Re-roll', cpCost: 1, phase: 'ANY', category: 'CORE', description: 'Re-roll one Hit roll, Wound roll, Damage roll, saving throw, Advance roll, Charge roll, Desperate Escape test, or Hazard test.', requiredKeywords: [] },
  { id: 'core-counter-offensive', name: 'Counter-Offensive', cpCost: 2, phase: 'FIGHT', category: 'CORE', description: 'Interrupt the combat sequence immediately after an enemy unit has fought to fight with one eligible unit from your army.', requiredKeywords: [] },
  { id: 'core-rapid-ingress', name: 'Rapid Ingress', cpCost: 1, phase: 'MOVEMENT', category: 'CORE', description: 'Your unit can arrive from Reserves as if it were the Reinforcements step of your Movement phase, during your opponent\'s turn.', requiredKeywords: ['DEEP STRIKE'] },
  { id: 'core-heroic-intervention', name: 'Heroic Intervention', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Declare a counter-charge with one eligible unit after an enemy unit completes a charge move within 6" of that unit.', requiredKeywords: ['CHARACTER', 'VEHICLE', 'WALKER'] },
  { id: 'core-smokescreen', name: 'Smokescreen', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Target unit gains the Benefit of Cover and the Stealth ability until the end of the phase.', requiredKeywords: ['SMOKE'] },
  { id: 'core-tank-shock', name: 'Tank Shock', cpCost: 1, phase: 'CHARGE', category: 'CORE', description: 'Select one enemy unit within Engagement Range after completing a Charge move; roll dice equal to your vehicle toughness and inflict mortal wounds on 5+.', requiredKeywords: ['VEHICLE'] },
  { id: 'core-go-to-ground', name: 'Go to Ground', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Target unit gains the Benefit of Cover and a 6+ invulnerable save until the end of the phase.', requiredKeywords: ['INFANTRY'] },
  { id: 'core-grenade', name: 'Grenade', cpCost: 1, phase: 'SHOOTING', category: 'CORE', description: 'Select one enemy unit within 8" and visible to this unit; roll six D6, each 4+ causes 1 mortal wound.', requiredKeywords: ['GRENADES'] }
];

function sanitizeId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

function extractProfiles(node, results = { units: [], rangedWeapons: [], meleeWeapons: [], abilities: [], rules: [] }) {
  if (!node || typeof node !== 'object') return results;

  if (node.profiles && Array.isArray(node.profiles)) {
    for (const p of node.profiles) {
      const type = p.typeName;
      const chars = parseCharacteristics(p.characteristics);
      if (type === 'Unit') {
        results.units.push({ name: p.name, ...chars });
      } else if (type === 'Ranged Weapons') {
        results.rangedWeapons.push({ name: p.name, ...chars });
      } else if (type === 'Melee Weapons') {
        results.meleeWeapons.push({ name: p.name, ...chars });
      } else if (type === 'Abilities') {
        results.abilities.push({ name: p.name, description: chars.Description || chars.description || '' });
      }
    }
  }

  if (node.rules && Array.isArray(node.rules)) {
    for (const r of node.rules) {
      results.rules.push({ name: r.name, description: r.description || '' });
    }
  }

  // Recurse down children
  for (const key of ['selectionEntries', 'sharedSelectionEntries', 'selectionEntryGroups', 'sharedSelectionEntryGroups', 'entryLinks']) {
    if (node[key] && Array.isArray(node[key])) {
      for (const child of node[key]) {
        extractProfiles(child, results);
      }
    }
  }

  return results;
}

const summaryList = [];

for (const file of files) {
  const filePath = path.join(bsDir, file);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err.message);
    continue;
  }

  const cat = raw.catalogue;
  if (!cat) continue;

  const factionName = cat.name.replace(/^(Xenos|Imperium|Chaos)\s*-\s*/, '').trim();
  const factionId = sanitizeId(file.replace('.json', ''));

  const datasheets = [];
  const allWeapons = new Map();
  const allAbilities = new Map();
  const detachments = [];

  // Extract shared weapons & profiles
  if (cat.sharedProfiles && Array.isArray(cat.sharedProfiles)) {
    for (const p of cat.sharedProfiles) {
      const chars = parseCharacteristics(p.characteristics);
      if (p.typeName === 'Ranged Weapons' || p.typeName === 'Melee Weapons') {
        allWeapons.set(p.name, {
          name: p.name,
          type: p.typeName === 'Ranged Weapons' ? 'Ranged' : 'Melee',
          range: chars['Range'] || 'Melee',
          attacks: chars['A'] || '1',
          skill: chars['BS'] || chars['WS'] || '3+',
          strength: parseInt(chars['S'], 10) || 4,
          armorPenetration: parseInt(chars['AP'], 10) || 0,
          damage: chars['D'] || '1',
          keywords: (chars['Keywords'] || '').split(',').map(s => s.trim()).filter(Boolean)
        });
      } else if (p.typeName === 'Abilities') {
        allAbilities.set(p.name, { name: p.name, description: chars['Description'] || '' });
      }
    }
  }

  // Extract units from sharedSelectionEntries and selectionEntries
  const entries = [
    ...(cat.sharedSelectionEntries || []),
    ...(cat.selectionEntries || [])
  ];

  for (const entry of entries) {
    // Only process units / models / vehicles / monsters
    const unitProfiles = [];
    const unitWeapons = [];
    const unitAbilities = [];

    const extracted = extractProfiles(entry);
    if (extracted.units.length === 0) {
      // Check if this is a detachment upgrade
      if (entry.type === 'upgrade' && /detachment/i.test(entry.name)) {
        detachments.push({
          name: entry.name,
          id: entry.id,
          rules: extracted.rules.map(r => r.name)
        });
      }
      continue;
    }

    const mainUnit = extracted.units[0];
    const keywords = [];
    if (entry.categoryLinks && Array.isArray(entry.categoryLinks)) {
      for (const cl of entry.categoryLinks) {
        if (cl.name) keywords.push(cl.name.toUpperCase());
      }
    }

    // Determine battlefield role
    let battlefieldRole = 'OTHER';
    if (keywords.includes('CHARACTER')) battlefieldRole = 'CHARACTER';
    else if (keywords.includes('BATTLELINE')) battlefieldRole = 'BATTLELINE';
    else if (keywords.includes('DEDICATED TRANSPORT')) battlefieldRole = 'DEDICATED_TRANSPORT';
    else if (keywords.includes('VEHICLE')) battlefieldRole = 'VEHICLE';
    else if (keywords.includes('MONSTER')) battlefieldRole = 'MONSTER';
    else if (keywords.includes('INFANTRY')) battlefieldRole = 'INFANTRY';
    else if (keywords.includes('MOUNTED')) battlefieldRole = 'MOUNTED';

    // Extract points
    let points = 0;
    if (entry.costs && Array.isArray(entry.costs)) {
      const ptCost = entry.costs.find(c => c.name === 'pts');
      if (ptCost && typeof ptCost.value === 'number') points = ptCost.value;
    }

    // Assemble unit model composition
    const models = extracted.units.map(u => ({
      name: u.name,
      baseSize: '32mm',
      count: 1
    }));

    // Assemble weapon list
    for (const w of extracted.rangedWeapons) {
      unitWeapons.push({
        name: w.name,
        type: 'Ranged',
        range: w.Range || '24"',
        attacks: w.A || '1',
        skill: w.BS || '3+',
        strength: parseInt(w.S, 10) || 4,
        armorPenetration: parseInt(w.AP, 10) || 0,
        damage: w.D || '1',
        keywords: (w.Keywords || '').split(',').map(s => s.trim()).filter(Boolean)
      });
    }
    for (const w of extracted.meleeWeapons) {
      unitWeapons.push({
        name: w.name,
        type: 'Melee',
        range: 'Melee',
        attacks: w.A || '1',
        skill: w.WS || '3+',
        strength: parseInt(w.S, 10) || 4,
        armorPenetration: parseInt(w.AP, 10) || 0,
        damage: w.D || '1',
        keywords: (w.Keywords || '').split(',').map(s => s.trim()).filter(Boolean)
      });
    }

    datasheets.push({
      id: entry.id || sanitizeId(entry.name),
      name: entry.name,
      factionId,
      factionName,
      battlefieldRole,
      basePoints: points,
      stats: {
        movement: mainUnit.M || '5"',
        toughness: parseInt(mainUnit.T, 10) || 4,
        save: mainUnit.Sv || '3+',
        invulnerableSave: mainUnit.InSv || undefined,
        wounds: parseInt(mainUnit.W, 10) || 1,
        leadership: mainUnit.LD || '6+',
        objectiveControl: parseInt(mainUnit.OC, 10) || 1
      },
      unitComposition: { models },
      keywords,
      abilities: extracted.abilities,
      weapons: unitWeapons
    });
  }

  const factionOutput = {
    id: factionId,
    name: factionName,
    sourceFile: file,
    totalDatasheets: datasheets.length,
    detachments,
    stratagems: CORE_STRATAGEMS,
    datasheets
  };

  fs.writeFileSync(path.join(outDir, `${factionId}.json`), JSON.stringify(factionOutput, null, 2), 'utf8');
  fs.writeFileSync(path.join(webDataDir, `${factionId}.json`), JSON.stringify(factionOutput, null, 2), 'utf8');

  summaryList.push({
    id: factionId,
    name: factionName,
    file: `${factionId}.json`,
    datasheetCount: datasheets.length,
    detachmentCount: detachments.length
  });

  console.log(`✓ [${factionName}] -> ${datasheets.length} datasheets`);
}

// Write master factions index
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(summaryList, null, 2), 'utf8');
fs.writeFileSync(path.join(webDataDir, 'index.json'), JSON.stringify(summaryList, null, 2), 'utf8');

console.log(`\nAll done! Extracted ${summaryList.length} factions into ${outDir} and ${webDataDir}`);
