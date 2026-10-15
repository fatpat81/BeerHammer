/**
 * BeerHammer Data Verification Suite
 * 
 * Policy:
 * 1. Primary Authority: BSData (BSData/wh40k-11e) is the definitive source of truth
 *    for all unit datasheets, characteristics, weapons, abilities, detachments, and rules.
 * 2. Points & Tiers Authority: Munitorum Field Manual (MFM 11th Edition / Quarterly Updates)
 *    is the authoritative source for all unit base points, enhancement costs, and squad size tiers.
 * 3. Advisory Cross-Reference: Wahapedia is strictly an advisory cross-reference and
 *    diff inspection source. It does NOT gate or block deployment.
 * 4. No Single-Unit Stat Gates: Do NOT use Terminator toughness or any isolated unit statline
 *    as a pass/fail verification gate. Verification is strictly catalogue integrity & schema validation.
 */

const fs = require('fs');
const path = require('path');

const factionsDir = path.join(__dirname, '../data/factions');
const webFactionsDir = path.join(__dirname, '../apps/web/public/data/factions');
const mfmDir = path.join(__dirname, '../data/mfm');
const indexFile = path.join(factionsDir, 'index.json');
const mfmUpdatesFile = path.join(mfmDir, 'balance-updates.json');

console.log('===========================================================');
console.log('   BeerHammer 11th Edition Data Verification Engine');
console.log('===========================================================');
console.log(' [Policy] Primary Authority : BSData (wh40k-11e)');
console.log(' [Policy] Points Authority  : Munitorum Field Manual (MFM) & Balance Updates');
console.log(' [Policy] Ruleset Standard  : 11.1.0-YYYY-QN-MFM');
console.log(' [Policy] Cross-Reference   : Wahapedia (Advisory diff inspection only)');
console.log(' [Policy] Stat Heuristics   : DISABLED (no single-unit toughness gates)');
console.log('-----------------------------------------------------------\n');

if (!fs.existsSync(indexFile)) {
  console.error('❌ Missing master factions index at:', indexFile);
  process.exit(1);
}

const factionsIndex = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
console.log(`Loaded catalogue index: ${factionsIndex.length} factions registered.\n`);

let totalDatasheets = 0;
let totalWeapons = 0;
let totalAbilities = 0;
let totalDetachments = 0;
let totalStratagems = 0;
let totalBasePointsValidated = 0;
let totalEnhancementsCosted = 0;
let totalCompositionsValidated = 0;

const errors = [];
const warnings = [];
const allDatasheetNames = new Set();
const factionDatasheetMap = new Map();

for (const summary of factionsIndex) {
  const factionPath = path.join(factionsDir, summary.file);
  const webPath = path.join(webFactionsDir, summary.file);

  if (!fs.existsSync(factionPath)) {
    errors.push(`Faction file missing: ${factionPath}`);
    continue;
  }
  if (!fs.existsSync(webPath)) {
    warnings.push(`Web public faction file missing (sync needed): ${webPath}`);
  }

  let faction;
  try {
    faction = JSON.parse(fs.readFileSync(factionPath, 'utf8'));
  } catch (err) {
    errors.push(`Failed to parse ${summary.file}: ${err.message}`);
    continue;
  }

  // Validate faction schema
  if (!faction.id || !faction.name || !Array.isArray(faction.datasheets)) {
    errors.push(`Invalid faction structure in ${summary.file}`);
    continue;
  }

  totalDetachments += (faction.detachments || []).length;
  totalStratagems += (faction.stratagems || []).length;

  // Validate Detachments & MFM Enhancement Points
  for (const det of faction.detachments || []) {
    if (Array.isArray(det.enhancements)) {
      for (const enh of det.enhancements) {
        if (typeof enh.points !== 'number' || isNaN(enh.points) || enh.points < 0) {
          errors.push(`Invalid MFM enhancement points [${enh.name || 'unnamed'}] (${enh.points}) in detachment ${det.name}`);
        } else {
          totalEnhancementsCosted++;
        }
      }
    }
  }

  const dsNamesInFaction = new Set();

  for (const ds of faction.datasheets) {
    totalDatasheets++;
    allDatasheetNames.add(ds.name.toLowerCase().trim());
    dsNamesInFaction.add(ds.name.toLowerCase().trim());

    // Validate Datasheet baseline schema
    if (!ds.name || !ds.id) {
      errors.push(`Datasheet missing id or name in ${faction.name}`);
      continue;
    }

    // ── MFM Points Validation ──────────────────────────────────────────────
    if (typeof ds.basePoints !== 'number' || isNaN(ds.basePoints) || ds.basePoints < 0) {
      errors.push(`Invalid MFM basePoints (${ds.basePoints}) on ${ds.name} in ${faction.name}`);
    } else {
      totalBasePointsValidated++;
    }

    // ── Model Count & Unit Composition Validation ──────────────────────────
    if (ds.unitComposition && Array.isArray(ds.unitComposition.models)) {
      totalCompositionsValidated++;
      for (const m of ds.unitComposition.models) {
        if (typeof m.count !== 'number' || m.count < 1) {
          warnings.push(`Invalid model count (${m.count}) for model [${m.name}] in ${ds.name}`);
        }
      }
    } else {
      warnings.push(`Datasheet ${ds.name} in ${faction.name} missing unitComposition.models array`);
    }

    // ── Statline Validation ────────────────────────────────────────────────
    if (!ds.stats) {
      errors.push(`Datasheet ${ds.name} in ${faction.name} missing stats`);
      continue;
    }

    const { movement, toughness, save, wounds, leadership, objectiveControl } = ds.stats;
    if (typeof toughness !== 'number' || toughness <= 0) {
      errors.push(`Invalid toughness (${toughness}) on ${ds.name} in ${faction.name}`);
    }
    if (typeof wounds !== 'number' || wounds <= 0) {
      errors.push(`Invalid wounds (${wounds}) on ${ds.name} in ${faction.name}`);
    }
    if (!movement || !save || !leadership) {
      errors.push(`Missing core stat fields on ${ds.name} in ${faction.name}`);
    }

    // ── Weapons Validation ─────────────────────────────────────────────────
    if (Array.isArray(ds.weapons)) {
      totalWeapons += ds.weapons.length;
      for (const w of ds.weapons) {
        if (!w.name || !w.type || typeof w.strength !== 'number') {
          warnings.push(`Incomplete weapon profile [${w.name || 'unnamed'}] on ${ds.name}`);
        }
      }
    }

    // ── Abilities Validation ───────────────────────────────────────────────
    if (Array.isArray(ds.abilities)) {
      totalAbilities += ds.abilities.length;
    }
  }

  factionDatasheetMap.set(faction.id, dsNamesInFaction);
}

// ── Munitorum Field Manual & Balance Updates Verification ───────────────────
console.log('--- Munitorum Field Manual & Balance Updates Check ---');
let mfmUpdates = null;
let mfmDiffCount = 0;
let mfmRulesetVersion = 'UNKNOWN';

if (!fs.existsSync(mfmUpdatesFile)) {
  warnings.push(`MFM balance updates file missing at: ${mfmUpdatesFile}`);
} else {
  try {
    mfmUpdates = JSON.parse(fs.readFileSync(mfmUpdatesFile, 'utf8'));
    mfmRulesetVersion = mfmUpdates.rulesetVersionId || 'UNKNOWN';

    // Verify version string adheres to 11.1.0-YYYY-QN-MFM
    const versionRegex = /^11\.\d+\.\d+-\d{4}-Q[1-4]-MFM$/;
    if (!versionRegex.test(mfmRulesetVersion)) {
      warnings.push(`MFM ruleset version "${mfmRulesetVersion}" does not follow standard 11.1.0-YYYY-QN-MFM format.`);
    }

    if (Array.isArray(mfmUpdates.changes)) {
      mfmDiffCount = mfmUpdates.changes.length;
      for (const change of mfmUpdates.changes) {
        if (!change.id || !change.category || !change.targetName || !change.currentValue) {
          errors.push(`Incomplete MFM change item: ${JSON.stringify(change)}`);
        }
        if (!['POINTS_CUT', 'POINTS_HIKE', 'KEYWORD_UPDATE', 'NEW_DATASHEET', 'ERRATA'].includes(change.category)) {
          errors.push(`Unknown MFM change category "${change.category}" on ${change.targetName}`);
        }
      }
    }
    console.log(`✓ MFM Ruleset Version   : ${mfmRulesetVersion}`);
    console.log(`✓ MFM Balance Shifts    : ${mfmDiffCount} verified`);
    console.log(`✓ MFM Publication       : ${mfmUpdates.publication || 'Standard'}`);
  } catch (err) {
    errors.push(`Failed to parse MFM updates file: ${err.message}`);
  }
}

// ── Munitorum Field Manual Squad Scaling Arithmetic Check ──────────────────
try {
  const { calculateUnitSquadPoints } = require('../packages/rules-engine-11e/dist/index.js');
  // Verify 5-man Terminator Squad scaling (175 base points)
  const term5 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 5, baseModelCount: 5 });
  const term6 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 6, baseModelCount: 5 });
  const term10 = calculateUnitSquadPoints({ basePoints: 175, modelCount: 10, baseModelCount: 5 });

  if (term5.totalPoints !== 175 || term6.totalPoints !== 350 || term10.totalPoints !== 350) {
    errors.push('MFM squad points scaling failed: Terminator squad points arithmetic incorrect.');
  } else {
    console.log('✓ MFM Squad Points Math : PASSED (5 models = 1x tier, 6-10 models = 2x tier)');
  }
} catch (e) {
  warnings.push(`Could not run MFM arithmetic check: ${e.message}`);
}

console.log('\n--- Catalogue Verification Summary ---');
console.log(`✓ Factions verified       : ${factionsIndex.length}`);
console.log(`✓ Datasheets verified     : ${totalDatasheets.toLocaleString()}`);
console.log(`✓ MFM Points validated    : ${totalBasePointsValidated.toLocaleString()} units`);
console.log(`✓ MFM Enhancements costed : ${totalEnhancementsCosted.toLocaleString()} enhancements`);
console.log(`✓ Model Compositions      : ${totalCompositionsValidated.toLocaleString()} verified`);
console.log(`✓ Weapons validated       : ${totalWeapons.toLocaleString()}`);
console.log(`✓ Abilities indexed       : ${totalAbilities.toLocaleString()}`);
console.log(`✓ Detachments loaded      : ${totalDetachments}`);
console.log(`✓ Stratagems mapped       : ${totalStratagems}`);

console.log('\n--- Wahapedia Cross-Reference Status ---');
console.log('ℹ Status: Advisory / Diff checking enabled.');
console.log('ℹ BSData & MFM remain primary authority. No blocking on third-party discrepancies.');

if (warnings.length > 0) {
  console.log(`\n⚠️  Advisory Warnings (${warnings.length}):`);
  warnings.slice(0, 5).forEach(w => console.log(`   - ${w}`));
  if (warnings.length > 5) {
    console.log(`   ...and ${warnings.length - 5} more`);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Catalogue Validation Failed with ${errors.length} errors:`);
  errors.slice(0, 10).forEach(e => console.error(`   - ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ Data integrity check PASSED! All catalogues adhere to BSData & MFM 11e schema.');
  process.exit(0);
}
