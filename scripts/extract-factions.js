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

function parseAttachableUnits(leaderDescription) {
  if (!leaderDescription || typeof leaderDescription !== 'string') return [];
  const lines = leaderDescription.split('\n');
  const units = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[■•\-\*]\s*/, '').trim();
    if (cleaned && !cleaned.toLowerCase().startsWith('this model') && cleaned.length > 2) {
      units.push(cleaned);
    }
  }
  return units;
}

// 1. First pass: Preload all catalogues into memory
const loadedCatalogues = new Map();
for (const file of files) {
  const filePath = path.join(bsDir, file);
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw && raw.catalogue) {
      loadedCatalogues.set(file, raw.catalogue);
    }
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
  }
}

// Helper to extract unit entries from a catalogue
function extractCatalogueDatasheets(cat, factionId, factionName) {
  const datasheets = [];
  const entries = [
    ...(cat.sharedSelectionEntries || []),
    ...(cat.selectionEntries || [])
  ];

  for (const entry of entries) {
    const extracted = extractProfiles(entry);
    if (extracted.units.length === 0) continue;

    const mainUnit = extracted.units[0];
    const keywords = [];
    if (entry.categoryLinks && Array.isArray(entry.categoryLinks)) {
      for (const cl of entry.categoryLinks) {
        if (cl.name) keywords.push(cl.name.toUpperCase());
      }
    }

    let battlefieldRole = 'OTHER';
    if (keywords.includes('CHARACTER')) battlefieldRole = 'CHARACTER';
    else if (keywords.includes('BATTLELINE')) battlefieldRole = 'BATTLELINE';
    else if (keywords.includes('DEDICATED TRANSPORT')) battlefieldRole = 'DEDICATED_TRANSPORT';
    else if (keywords.includes('VEHICLE')) battlefieldRole = 'VEHICLE';
    else if (keywords.includes('MONSTER')) battlefieldRole = 'MONSTER';
    else if (keywords.includes('INFANTRY')) battlefieldRole = 'INFANTRY';
    else if (keywords.includes('MOUNTED')) battlefieldRole = 'MOUNTED';

    let points = 0;
    if (entry.costs && Array.isArray(entry.costs)) {
      const ptCost = entry.costs.find(c => c.name === 'pts');
      if (ptCost && typeof ptCost.value === 'number') points = ptCost.value;
    }

    const unitWeapons = [];
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

    // Check for Leader ability and attachable bodyguards
    const leaderAbility = extracted.abilities.find(a => a.name.toLowerCase() === 'leader');
    const attachableTo = leaderAbility ? parseAttachableUnits(leaderAbility.description) : [];

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
      unitComposition: { models: extracted.units.map(u => ({ name: u.name, baseSize: '32mm', count: 1 })) },
      keywords,
      abilities: extracted.abilities,
      weapons: unitWeapons,
      isLeader: battlefieldRole === 'CHARACTER' && !!leaderAbility,
      attachableTo
    });
  }

  return datasheets;
}

// Helper to extract detachments and enhancements
function extractDetachmentsAndEnhancements(cat) {
  const detachments = [];
  const enhancementsByGroup = new Map();

  function scanNode(node) {
    if (!node || typeof node !== 'object') return;

    // Scan for detachments
    const isDet = (node.categoryLinks && node.categoryLinks.some(cl => /detachment/i.test(cl.name))) ||
                  (node.type === 'upgrade' && /detachment|task force|spearhead|phalanx|host|cult/i.test(node.name || ''));

    if (isDet && node.name && !/enhancement/i.test(node.name)) {
      const extracted = extractProfiles(node);
      detachments.push({
        id: node.id || sanitizeId(node.name),
        name: node.name,
        rules: extracted.rules.map(r => r.name),
        enhancements: []
      });
    }

    // Scan for enhancement groups
    if (node.selectionEntryGroups && Array.isArray(node.selectionEntryGroups)) {
      for (const g of node.selectionEntryGroups) {
        if (/enhancement/i.test(g.name)) {
          const list = [];
          if (g.selectionEntries && Array.isArray(g.selectionEntries)) {
            for (const e of g.selectionEntries) {
              const ptCost = (e.costs || []).find(c => c.name === 'pts');
              const extracted = extractProfiles(e);
              const desc = extracted.abilities.map(a => a.description).join(' ') ||
                           extracted.rules.map(r => r.description).join(' ');
              list.push({
                id: e.id || sanitizeId(e.name),
                name: e.name,
                points: ptCost ? ptCost.value : 0,
                description: desc
              });
            }
          }
          if (list.length > 0) {
            enhancementsByGroup.set(g.name.replace(/\s+Enhancements$/i, '').trim().toLowerCase(), list);
          }
        }
      }
    }

    for (const k of Object.keys(node)) {
      if (Array.isArray(node[k])) {
        for (const item of node[k]) scanNode(item);
      }
    }
  }

  scanNode(cat);

  // Link enhancements to detachments
  for (const det of detachments) {
    const detKey = det.name.toLowerCase();
    for (const [groupName, enhs] of enhancementsByGroup.entries()) {
      if (detKey.includes(groupName) || groupName.includes(detKey)) {
        det.enhancements = enhs;
        break;
      }
    }
  }

  // De-duplicate detachments by name
  const unique = [];
  const seen = new Set();
  for (const d of detachments) {
    if (!seen.has(d.name)) {
      seen.add(d.name);
      unique.push(d);
    }
  }

  return unique;
}

// Major Playable Factions Configuration
const FACTION_DEFINITIONS = [
  // ── Imperium ────────────────────────────────────────────────────────────
  {
    id: 'imperium-space-marines',
    name: 'Adeptus Astartes (Space Marines)',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Space Marines.json',
    subfactions: [
      { id: 'ultramarines', name: 'Ultramarines', file: 'Imperium - Ultramarines.json' },
      { id: 'blood-angels', name: 'Blood Angels', file: 'Imperium - Blood Angels.json' },
      { id: 'dark-angels', name: 'Dark Angels', file: 'Imperium - Dark Angels.json' },
      { id: 'space-wolves', name: 'Space Wolves', file: 'Imperium - Space Wolves.json' },
      { id: 'black-templars', name: 'Black Templars', file: 'Imperium - Black Templars.json' },
      { id: 'deathwatch', name: 'Deathwatch', file: 'Imperium - Deathwatch.json' },
      { id: 'imperial-fists', name: 'Imperial Fists', file: 'Imperium - Imperial Fists.json' },
      { id: 'iron-hands', name: 'Iron Hands', file: 'Imperium - Iron Hands.json' },
      { id: 'salamanders', name: 'Salamanders', file: 'Imperium - Salamanders.json' },
      { id: 'raven-guard', name: 'Raven Guard', file: 'Imperium - Raven Guard.json' },
      { id: 'white-scars', name: 'White Scars', file: 'Imperium - White Scars.json' }
    ]
  },
  {
    id: 'imperium-astra-militarum',
    name: 'Astra Militarum',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Astra Militarum.json',
    libraryFile: 'Imperium - Astra Militarum - Library.json',
    subfactions: [
      { id: 'cadian', name: 'Cadian Shock Troops' },
      { id: 'catachan', name: 'Catachan Jungle Fighters' },
      { id: 'krieg', name: 'Death Korps of Krieg' },
      { id: 'scions', name: 'Militarum Tempestus' }
    ]
  },
  {
    id: 'imperium-adepta-sororitas',
    name: 'Adepta Sororitas',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Adepta Sororitas.json',
    subfactions: [
      { id: 'our-martyred-lady', name: 'Order of Our Martyred Lady' },
      { id: 'bloody-rose', name: 'Order of the Bloody Rose' },
      { id: 'argent-shroud', name: 'Order of the Argent Shroud' }
    ]
  },
  {
    id: 'imperium-adeptus-custodes',
    name: 'Adeptus Custodes',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Adeptus Custodes.json',
    subfactions: [
      { id: 'solar-watch', name: 'Solar Watch' },
      { id: 'shadowkeepers', name: 'Shadowkeepers' },
      { id: 'emissaries-imperatus', name: 'Emissaries Imperatus' }
    ]
  },
  {
    id: 'imperium-adeptus-mechanicus',
    name: 'Adeptus Mechanicus',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Adeptus Mechanicus.json',
    subfactions: [
      { id: 'mars', name: 'Mars' },
      { id: 'lucius', name: 'Lucius' },
      { id: 'ryza', name: 'Ryza' }
    ]
  },
  {
    id: 'imperium-grey-knights',
    name: 'Grey Knights',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Grey Knights.json'
  },
  {
    id: 'imperium-imperial-knights',
    name: 'Imperial Knights',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Imperial Knights.json',
    libraryFile: 'Imperium - Imperial Knights - Library.json'
  },
  {
    id: 'imperium-agents-of-the-imperium',
    name: 'Agents of the Imperium',
    grandAlliance: 'Imperium',
    primaryFile: 'Imperium - Agents of the Imperium.json'
  },

  // ── Chaos ────────────────────────────────────────────────────────────────
  {
    id: 'chaos-chaos-space-marines',
    name: 'Chaos Space Marines',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - Chaos Space Marines.json',
    subfactions: [
      { id: 'black-legion', name: 'Black Legion' },
      { id: 'iron-warriors', name: 'Iron Warriors' },
      { id: 'night-lords', name: 'Night Lords' },
      { id: 'word-bearers', name: 'Word Bearers' },
      { id: 'alpha-legion', name: 'Alpha Legion' }
    ]
  },
  {
    id: 'chaos-death-guard',
    name: 'Death Guard',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - Death Guard.json'
  },
  {
    id: 'chaos-thousand-sons',
    name: 'Thousand Sons',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - Thousand Sons.json'
  },
  {
    id: 'chaos-world-eaters',
    name: 'World Eaters',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - World Eaters.json'
  },
  {
    id: 'chaos-emperor-s-children',
    name: "Emperor's Children",
    grandAlliance: 'Chaos',
    primaryFile: "Chaos - Emperor's Children.json"
  },
  {
    id: 'chaos-chaos-daemons',
    name: 'Chaos Daemons',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - Chaos Daemons.json',
    libraryFile: 'Chaos - Chaos Daemons Library.json',
    subfactions: [
      { id: 'khorne', name: 'Daemons of Khorne' },
      { id: 'nurgle', name: 'Daemons of Nurgle' },
      { id: 'tzeentch', name: 'Daemons of Tzeentch' },
      { id: 'slaanesh', name: 'Daemons of Slaanesh' }
    ]
  },
  {
    id: 'chaos-chaos-knights',
    name: 'Chaos Knights',
    grandAlliance: 'Chaos',
    primaryFile: 'Chaos - Chaos Knights.json',
    libraryFile: 'Chaos - Chaos Knights Library.json'
  },

  // ── Xenos ────────────────────────────────────────────────────────────────
  {
    id: 'necrons',
    name: 'Necrons',
    grandAlliance: 'Xenos',
    primaryFile: 'Necrons.json',
    subfactions: [
      { id: 'szarekhan', name: 'Szarekhan Dynasty' },
      { id: 'sautekh', name: 'Sautekh Dynasty' },
      { id: 'mephrit', name: 'Mephrit Dynasty' },
      { id: 'novokh', name: 'Novokh Dynasty' }
    ]
  },
  {
    id: 't-au-empire',
    name: "T'au Empire",
    grandAlliance: 'Xenos',
    primaryFile: "T'au Empire.json",
    subfactions: [
      { id: 'tau-sept', name: "T'au Sept" },
      { id: 'viorla', name: "Vior'la Sept" },
      { id: 'farsight', name: 'Farsight Enclaves' }
    ]
  },
  {
    id: 'tyranids',
    name: 'Tyranids',
    grandAlliance: 'Xenos',
    primaryFile: 'Tyranids.json',
    subfactions: [
      { id: 'leviathan', name: 'Hive Fleet Leviathan' },
      { id: 'kraken', name: 'Hive Fleet Kraken' },
      { id: 'behemoth', name: 'Hive Fleet Behemoth' }
    ]
  },
  {
    id: 'genestealer-cults',
    name: 'Genestealer Cults',
    grandAlliance: 'Xenos',
    primaryFile: 'Genestealer Cults.json'
  },
  {
    id: 'orks',
    name: 'Orks',
    grandAlliance: 'Xenos',
    primaryFile: 'Orks.json',
    subfactions: [
      { id: 'goffs', name: 'Goffs' },
      { id: 'bad-moons', name: 'Bad Moons' },
      { id: 'evil-sunz', name: 'Evil Sunz' },
      { id: 'deathskulls', name: 'Deathskulls' }
    ]
  },
  {
    id: 'aeldari-craftworlds',
    name: 'Aeldari (Craftworlds)',
    grandAlliance: 'Xenos',
    primaryFile: 'Aeldari - Craftworlds.json',
    libraryFile: 'Aeldari - Aeldari Library.json',
    subfactions: [
      { id: 'ulthe', name: 'Ulthwé' },
      { id: 'biel-tan', name: 'Biel-Tan' },
      { id: 'iyanden', name: 'Iyanden' },
      { id: 'saim-hann', name: 'Saim-Hann' }
    ]
  },
  {
    id: 'aeldari-drukhari',
    name: 'Drukhari',
    grandAlliance: 'Xenos',
    primaryFile: 'Aeldari - Drukhari.json',
    libraryFile: 'Aeldari - Aeldari Library.json'
  },
  {
    id: 'leagues-of-votann',
    name: 'Leagues of Votann',
    grandAlliance: 'Xenos',
    primaryFile: 'Leagues of Votann.json'
  },

  // ── Legends & Auxiliaries (Toggleable per Q3=A) ──────────────────────────
  {
    id: 'library-astartes-heresy-legends',
    name: 'Astartes Heresy Legends',
    grandAlliance: 'Imperium',
    primaryFile: 'Library - Astartes Heresy Legends.json',
    isLegends: true
  },
  {
    id: 'library-titans',
    name: 'Titans (Adeptus Titanicus & Traitoris)',
    grandAlliance: 'Other',
    primaryFile: 'Library - Titans.json',
    isLegends: true
  },
  {
    id: 'library-tyranids',
    name: 'Tyranids Legends',
    grandAlliance: 'Xenos',
    primaryFile: 'Library - Tyranids.json',
    isLegends: true
  },
  {
    id: 'unaligned-forces',
    name: 'Unaligned Forces',
    grandAlliance: 'Other',
    primaryFile: 'Unaligned Forces.json',
    isLegends: true
  }
];

const summaryList = [];

for (const fDef of FACTION_DEFINITIONS) {
  const cat = loadedCatalogues.get(fDef.primaryFile);
  if (!cat) {
    console.warn(`Missing primary catalogue for ${fDef.name}: ${fDef.primaryFile}`);
    continue;
  }

  // Extract base datasheets
  let datasheets = extractCatalogueDatasheets(cat, fDef.id, fDef.name);

  // Merge Library datasheets if companion library exists (Q2=A)
  if (fDef.libraryFile && loadedCatalogues.has(fDef.libraryFile)) {
    const libCat = loadedCatalogues.get(fDef.libraryFile);
    const libDatasheets = extractCatalogueDatasheets(libCat, fDef.id, fDef.name);

    if (fDef.id === 'aeldari-craftworlds') {
      // Keep Asuryani / Craftworlds units
      const craftworldUnits = libDatasheets.filter(d => !d.keywords.some(k => k.includes('DRUKHARI')));
      datasheets = [...datasheets, ...craftworldUnits];
    } else if (fDef.id === 'aeldari-drukhari') {
      // Keep Drukhari units
      const drukhariUnits = libDatasheets.filter(d => d.keywords.some(k => k.includes('DRUKHARI')));
      datasheets = [...datasheets, ...drukhariUnits];
    } else {
      datasheets = [...datasheets, ...libDatasheets];
    }
  }

  // Extract detachments and their enhancements (Q7=A)
  let detachments = extractDetachmentsAndEnhancements(cat);
  if (detachments.length === 0 && fDef.libraryFile && loadedCatalogues.has(fDef.libraryFile)) {
    detachments = extractDetachmentsAndEnhancements(loadedCatalogues.get(fDef.libraryFile));
  }

  // Process subfactions (e.g. Space Marine chapters) (Q6=A)
  const processedSubfactions = [];
  if (fDef.subfactions) {
    for (const sub of fDef.subfactions) {
      let subDatasheets = [];
      let subDetachments = [];
      if (sub.file && loadedCatalogues.has(sub.file)) {
        const subCat = loadedCatalogues.get(sub.file);
        subDatasheets = extractCatalogueDatasheets(subCat, sub.id, sub.name);
        subDetachments = extractDetachmentsAndEnhancements(subCat);
      }
      processedSubfactions.push({
        id: sub.id,
        name: sub.name,
        datasheetCount: subDatasheets.length,
        datasheets: subDatasheets,
        detachments: subDetachments
      });
    }
  }

  // De-duplicate datasheets by name
  const uniqueDatasheets = [];
  const seenUnits = new Set();
  for (const ds of datasheets) {
    if (!seenUnits.has(ds.name)) {
      seenUnits.add(ds.name);
      uniqueDatasheets.push(ds);
    }
  }

  const factionOutput = {
    id: fDef.id,
    name: fDef.name,
    grandAlliance: fDef.grandAlliance,
    isLegends: !!fDef.isLegends,
    totalDatasheets: uniqueDatasheets.length,
    detachments,
    stratagems: CORE_STRATAGEMS,
    subfactions: processedSubfactions,
    datasheets: uniqueDatasheets
  };

  fs.writeFileSync(path.join(outDir, `${fDef.id}.json`), JSON.stringify(factionOutput, null, 2), 'utf8');
  fs.writeFileSync(path.join(webDataDir, `${fDef.id}.json`), JSON.stringify(factionOutput, null, 2), 'utf8');

  summaryList.push({
    id: fDef.id,
    name: fDef.name,
    grandAlliance: fDef.grandAlliance,
    isLegends: !!fDef.isLegends,
    file: `${fDef.id}.json`,
    datasheetCount: uniqueDatasheets.length,
    detachmentCount: detachments.length,
    subfactions: processedSubfactions.map(s => ({ id: s.id, name: s.name, datasheetCount: s.datasheetCount }))
  });

  console.log(`✓ [${fDef.name}] (${fDef.grandAlliance}): ${uniqueDatasheets.length} datasheets, ${detachments.length} detachments, ${processedSubfactions.length} subfactions`);
}

// Write master factions index (Q4=A)
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(summaryList, null, 2), 'utf8');
fs.writeFileSync(path.join(webDataDir, 'index.json'), JSON.stringify(summaryList, null, 2), 'utf8');

console.log(`\nAll done! Extracted ${summaryList.length} canonical factions into ${outDir} and ${webDataDir}`);
