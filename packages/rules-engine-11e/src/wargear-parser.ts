// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Wargear AST Parser (§7.1)
// Compiles natural-language wargear option text into structured ASTs
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WargearRuleAST,
  TargetRole,
  ConsumedSlot,
  WargearSelection,
  WeaponProfile,
  EquippedWeaponBadge,
  WargearValidationError,
} from '@forceorg/types';

/**
 * Generates a URL-safe slug from a weapon name.
 */
export function slugify(text: string): string {
  return 'wep_' + text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Parses a count + name string like "1 Power Fist" or "Boltgun".
 */
export function parseCountAndName(itemStr: string): { count: number; name: string } {
  const clean = itemStr.trim().replace(/^•\s*/, '');
  const match = clean.match(/^(\d+)\s+(.*)/i);
  if (match && match[1] && match[2]) {
    return { count: parseInt(match[1], 10), name: match[2].trim() };
  }
  return { count: 1, name: clean };
}

/**
 * Splits a comma/or-separated option list into structured option entries.
 */
export function parseOptionList(rawOptions: string) {
  return rawOptions
    .replace(/\s+(?:or|and\/or)\s+/gi, ', ')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0 && !p.toLowerCase().startsWith('1 of the following'))
    .map(p => {
      const { count, name } = parseCountAndName(p);
      return { id: slugify(name), name, count, pointsDelta: 0 };
    });
}

/**
 * Detects whether a role name corresponds to a squad leader.
 */
function detectTargetRole(roleName: string): TargetRole {
  if (/sergeant|champion|leader|captain|aspiring/i.test(roleName)) return 'SERGEANT';
  if (/chassis|hull|body/i.test(roleName)) return 'CHASSIS';
  return 'TROOPER';
}

/**
 * Infers which weapon slots a replacement option consumes.
 */
function inferConsumedSlots(optionNames: string[]): ConsumedSlot[] {
  const hasRanged = optionNames.some(n => /bolter|cannon|flamer|rifle|pistol|melta|plasma|las/i.test(n));
  const hasMelee = optionNames.some(n => /sword|fist|hammer|axe|claw|blade|knife|maul/i.test(n));

  if (hasRanged && hasMelee) return ['primary_ranged', 'melee'];
  if (hasMelee) return ['melee'];
  return ['primary_ranged'];
}

/**
 * Compiles raw Wahapedia wargear option text (or HTML) into an array of
 * structured WargearRuleAST nodes.
 *
 * Handles patterns:
 * - "For every N models, 1 model can replace X with Y"
 * - "The Sergeant's boltgun can be replaced with X"
 * - "Any model can be equipped with X" (ADD_ON)
 * - "1 model can replace X with Y"
 */
export function compileWahapediaWargear(rawTextOrHtml: string): WargearRuleAST[] {
  // Strip HTML tags and normalize line breaks
  const plainText = rawTextOrHtml
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .trim();

  const lines = plainText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const ast: WargearRuleAST[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/^•\s*/, '').trim();
    const ruleId = `rule_gen_${Date.now()}_${index}`;

    // ── Pattern 1: Scale-factor replacement ────────────────────────────────
    // "For every 5 models in this unit, 1 model can replace X with Y"
    const scaleMatch = line.match(
      /(?:for every|for each)\s+(\d+)\s+models.*?can\s+replace\s+(.*?)\s+with\s+(.*)/i
    );
    if (scaleMatch) {
      const scaleFactor = parseInt(scaleMatch[1]!, 10);
      const options = parseOptionList(scaleMatch[3]!);
      ast.push({
        id: ruleId,
        rawText: rawLine,
        ruleType: 'REPLACE',
        scope: { targetRole: 'TROOPER', scaleFactor, modelLimit: 1 },
        replaces: parseCountAndName(scaleMatch[2]!),
        options,
        constraint: {
          maxSelections: `floor(unit.modelCount / ${scaleFactor})`,
          consumedSlots: inferConsumedSlots(options.map(o => o.name)),
          isMutuallyExclusive: true,
        },
      });
      return;
    }

    // ── Pattern 2: "Any model can be equipped with X" (ADD_ON) ─────────────
    const addOnMatch = line.match(
      /(?:any|all|each)\s+(?:model|models?).*?(?:can\s+be\s+equipped|may\s+take|can\s+take)\s+(?:with\s+)?(.*)/i
    );
    if (addOnMatch) {
      const options = parseOptionList(addOnMatch[1]!);
      ast.push({
        id: ruleId,
        rawText: rawLine,
        ruleType: 'ADD_ON',
        scope: { targetRole: 'ANY', modelLimit: 'ALL' },
        options,
        constraint: {
          maxSelections: 'ALL',
          consumedSlots: inferConsumedSlots(options.map(o => o.name)),
          isMutuallyExclusive: false,
        },
      });
      return;
    }

    // ── Pattern 3: Numeric model count replacement ─────────────────────────
    // "2 models can replace their boltgun with X"
    const numericMatch = line.match(
      /^(\d+)\s+models?\s+can\s+replace\s+(?:their\s+)?(.*?)\s+with\s+(.*)/i
    );
    if (numericMatch) {
      const modelLimit = parseInt(numericMatch[1]!, 10);
      const options = parseOptionList(numericMatch[3]!);
      ast.push({
        id: ruleId,
        rawText: rawLine,
        ruleType: 'REPLACE',
        scope: { targetRole: 'TROOPER', modelLimit },
        replaces: parseCountAndName(numericMatch[2]!),
        options,
        constraint: {
          maxSelections: modelLimit,
          consumedSlots: inferConsumedSlots(options.map(o => o.name)),
          isMutuallyExclusive: true,
        },
      });
      return;
    }

    // ── Pattern 4: Role-targeted replacement (Passive voice) ───────────────
    // "The Sergeant's boltgun can be replaced with X"
    const passiveMatch = line.match(
      /^(?:the\s+)?([A-Za-z\s]+?)(?:'s)?\s+(.*?)\s+can\s+be\s+replaced\s+with\s+(.*)/i
    );
    if (passiveMatch) {
      const roleName = passiveMatch[1]!.trim();
      const targetRole = detectTargetRole(roleName);
      const options = parseOptionList(passiveMatch[3]!);
      ast.push({
        id: ruleId,
        rawText: rawLine,
        ruleType: 'REPLACE',
        scope: { targetRole, rawRoleName: roleName, modelLimit: 1 },
        replaces: parseCountAndName(passiveMatch[2]!),
        options,
        constraint: {
          maxSelections: 1,
          consumedSlots: inferConsumedSlots(options.map(o => o.name)),
          isMutuallyExclusive: true,
        },
      });
      return;
    }

    // ── Pattern 5: Role-targeted replacement (Active voice) ────────────────
    // "The Champion can replace his bolt pistol with X"
    const activeMatch = line.match(
      /^(?:the\s+)?([A-Za-z\s]+?)\s+can\s+replace\s+(?:their|his|her|its)?\s*(.*?)\s+with\s+(.*)/i
    );
    if (activeMatch) {
      const roleName = activeMatch[1]!.trim();
      const targetRole = detectTargetRole(roleName);
      const options = parseOptionList(activeMatch[3]!);
      ast.push({
        id: ruleId,
        rawText: rawLine,
        ruleType: 'REPLACE',
        scope: { targetRole, rawRoleName: roleName, modelLimit: 1 },
        replaces: parseCountAndName(activeMatch[2]!),
        options,
        constraint: {
          maxSelections: 1,
          consumedSlots: inferConsumedSlots(options.map(o => o.name)),
          isMutuallyExclusive: true,
        },
      });
      return;
    }
  });

  return ast;
}

/**
 * Normalizes a weapon name to remove firing mode prefixes (➤, •) and suffixes (- frag, - krak, - standard, - supercharge).
 */
export function normalizeBaseWeaponName(name: string): string {
  return name
    .replace(/^[➤•\s]+/, '')
    .replace(/\s*-\s*(frag|krak|standard|supercharge|focused|dispersed|sweep|strike|overcharge)$/i, '')
    .trim();
}

/**
 * Cleans a weapon display name by stripping raw prefixes like "➤ ".
 */
export function cleanDisplayName(name: string): string {
  return name.replace(/^[➤•\s]+/, '').trim();
}

/**
 * Determines the true 40k tabletop baseline squad model threshold for a unit.
 * Accounts for 10e/11e unit size tiers (e.g. 5-model infantry, 3-model elites, 10-model hordes)
 * even when raw datasheets only list 1 model entry in unitComposition.
 */
export function getUnitBaseModelThreshold(unit: {
  name: string;
  battlefieldRole?: string;
  keywords?: string[];
  basePoints?: number;
  modelComposition?: { name: string; count: number }[];
}): number {
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

  const isVehicleOrMonster =
    role === 'VEHICLE' ||
    role === 'MONSTER' ||
    role === 'FORTIFICATION' ||
    rawKeywords.some(
      k =>
        k.includes('vehicle') ||
        k.includes('monster') ||
        k.includes('walker') ||
        k.includes('fortification') ||
        k.includes('titanic') ||
        k.includes('aircraft')
    );

  // Some walkers / vehicles are taken in multi-model squadrons (e.g. Broadside, Armigers, War Dogs, Tarantula)
  const isSquadron = /broadside|armiger|war dog|tarantula|land speeder/i.test(lowerName);
  if (isVehicleOrMonster && !isSquadron) return 1;

  // 3. Horde / Swarm units (10 models baseline, scale to 20)
  if (
    /cultist mob|cultist|boyz|beast snagga|gretchin|grots|shock troop|infantry squad|catachan|krieg|jungle fighter|poxwalker|termagant|hormagaunt|gargoyle|bloodletter|daemonette|plaguebearer|pink horror|blue horror|kroot carnivore|skitarii|kabalite|wyche|fire warrior|breacher|strike team|necron warrior|jakhal|tzaangor|hearthkyn/i.test(
      lowerName
    )
  ) {
    return 10;
  }

  // 4. Elite 3-model squads (3 models baseline, scale to 6)
  if (
    /aggressor|eradicator|bladeguard|inceptor|suppressor|eliminator|centurion|eightbound|deathshroud|allarus|crisis|broadside|stealth|wraithguard|wraithblade|squighog|meganob|paragon warsuit|tyranid warrior|zoanthrope|venomthrope|hive guard|tyrant guard|ravener|von ryan|skorpekh|ophydian|tomb blade|lokhust|windrider|shining spear|skyweaver|biker|outrider|ogryn|bullgryn|kataphron/i.test(
      lowerName
    )
  ) {
    return 3;
  }

  // 5. Terminators (5 models baseline, scale to 10)
  // All Terminator squads (Space Marines, Chaos, Grey Knights, Death Guard, Thousand Sons, Dark Angels, Space Wolves)
  if (/terminator/i.test(lowerName)) {
    return 5;
  }

  // 6. Standard Infantry & Battleline squads (5 models baseline, scale to 10)
  if (
    /intercessor|infernus|infiltrator|incursor|tactical|scout|legionar|chosen|havoc|retributor|sister|dominion|celestian|seraphim|zephyrim|repentia|raptor|warp talon|rubric|plague marine|immortal|deathmark|lychguard|praetorian|sternguard|vanguard|hellblaster|desolation|reiver|hearthguard|pteraxii|ruststalker|sicarian|avenger|scorpion|banshee|dragon|hawk|spider|reaper|wrack|mandrake|incubi|aberrant|genestealer|metamorph|hybrid/i.test(
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

/**
 * Calculates a unit's 40k points cost and tier based on squad size thresholds.
 * In 10e/11e, squads have fixed tier increments (e.g., 5-model baseline vs 10-model tier).
 * If a unit contains models above the baseline threshold (e.g., 6 models), it pays the full points
 * of the higher tier (e.g., 10-man squad).
 */
export function calculateUnitSquadPoints(params: {
  basePoints: number;
  modelCount: number;
  baseModelCount: number;
  isCharacter?: boolean;
  enhancementPoints?: number;
}): {
  totalPoints: number;
  tierMultiplier: number;
  tierMaxModels: number;
  isUnderstrength: boolean;
} {
  const {
    basePoints,
    modelCount,
    baseModelCount = 5,
    isCharacter = false,
    enhancementPoints = 0,
  } = params;

  if (isCharacter || baseModelCount <= 1) {
    return {
      totalPoints: basePoints + enhancementPoints,
      tierMultiplier: 1,
      tierMaxModels: 1,
      isUnderstrength: false,
    };
  }

  const threshold = Math.max(1, baseModelCount);
  const tierMultiplier = Math.max(1, Math.ceil(modelCount / threshold));
  const tierMaxModels = tierMultiplier * threshold;
  const isUnderstrength = modelCount % threshold !== 0;
  const totalPoints = (basePoints * tierMultiplier) + enhancementPoints;

  return {
    totalPoints,
    tierMultiplier,
    tierMaxModels,
    isUnderstrength,
  };
}

export interface WargearSlot {
  id: string;
  ruleId: string;
  category: 'LEADER' | 'SPECIAL' | 'HEAVY' | 'ADD_ON';
  title: string;
  replacesName?: string;
  scaleFactor?: number;
  maxAllowed: number;
  options: {
    id: string;
    name: string;
    count: number;
    pointsDelta: number;
  }[];
}

/**
 * Validates a unit's wargear selections against tournament rules and AST constraints.
 */
export function validateWargearLoadout(params: {
  modelCount: number;
  wargearSelections: WargearSelection[];
  rules?: WargearRuleAST[];
  catalogWeapons?: WeaponProfile[];
}): { isValid: boolean; errors: WargearValidationError[] } {
  const errors: WargearValidationError[] = [];
  const { modelCount, wargearSelections = [], rules = [] } = params;

  // Track counts per rule
  const countByRule = new Map<string, number>();
  for (const sel of wargearSelections) {
    if (!sel || !sel.ruleId) continue;
    countByRule.set(sel.ruleId, (countByRule.get(sel.ruleId) || 0) + (sel.count || 0));
  }

  for (const rule of rules) {
    const selectedCount = countByRule.get(rule.id) || 0;
    if (selectedCount === 0) continue;

    // Check scale factor (e.g. 1 per 5 models)
    if (rule.scope.scaleFactor && rule.scope.scaleFactor > 0) {
      const allowedMax = Math.floor(modelCount / rule.scope.scaleFactor);
      if (selectedCount > allowedMax) {
        const offendingSelections = wargearSelections.filter(s => s.ruleId === rule.id);
        const weaponNames = offendingSelections.map(s => s.weaponName || 'Selected Weapon').join(', ');
        errors.push({
          ruleId: rule.id,
          wargearName: weaponNames,
          message: `Tournament limit exceeded: [${weaponNames}] allowed max ${allowedMax} per ${rule.scope.scaleFactor} models (selected: ${selectedCount} for squad of ${modelCount}).`,
          severity: 'RED',
        });
      }
    } else if (typeof rule.constraint.maxSelections === 'number') {
      const allowedMax = rule.constraint.maxSelections;
      if (selectedCount > allowedMax) {
        const offendingSelections = wargearSelections.filter(s => s.ruleId === rule.id);
        const weaponNames = offendingSelections.map(s => s.weaponName || 'Selected Weapon').join(', ');
        errors.push({
          ruleId: rule.id,
          wargearName: weaponNames,
          message: `Tournament limit exceeded: [${weaponNames}] max ${allowedMax} selection(s) allowed (selected: ${selectedCount}).`,
          severity: 'RED',
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds interactive wargear slot options for Edit Mode.
 * Ensures complete ranged, melee, and support equipment / add-on options are available.
 */
export function buildUnitWargearSlots(params: {
  catalogWeapons: WeaponProfile[];
  wargearRules?: WargearRuleAST[];
  isLeader?: boolean;
  modelCount?: number;
  abilities?: { name: string; description: string }[];
  unitName?: string;
  keywords?: string[];
}): {
  leaderSlots: WargearSlot[];
  squadSpecialSlots: WargearSlot[];
  addOnSlots: WargearSlot[];
} {
  const {
    catalogWeapons = [],
    wargearRules = [],
    isLeader = false,
    modelCount = 5,
    abilities = [],
    unitName = '',
    keywords = [],
  } = params;

  const leaderSlots: WargearSlot[] = [];
  const squadSpecialSlots: WargearSlot[] = [];
  const addOnSlots: WargearSlot[] = [];

  // Helper classification functions
  const isMelee = (w: WeaponProfile) =>
    w.type?.toLowerCase() === 'melee' || w.range?.toLowerCase() === 'melee';
  const isPistol = (w: WeaponProfile) =>
    w.keywords?.some(k => k.toLowerCase() === 'pistol') ||
    w.name.toLowerCase().includes('pistol') ||
    w.name.toLowerCase().includes('hand flamer');

  if (wargearRules.length > 0) {
    for (const rule of wargearRules) {
      let maxAllowed = 1;
      if (rule.scope.scaleFactor && rule.scope.scaleFactor > 0) {
        maxAllowed = Math.floor(modelCount / rule.scope.scaleFactor);
      } else if (typeof rule.constraint.maxSelections === 'number') {
        maxAllowed = rule.constraint.maxSelections;
      } else if (rule.scope.modelLimit && typeof rule.scope.modelLimit === 'number') {
        maxAllowed = rule.scope.modelLimit;
      }

      const slot: WargearSlot = {
        id: rule.id,
        ruleId: rule.id,
        category:
          rule.scope.targetRole === 'SERGEANT'
            ? 'LEADER'
            : rule.ruleType === 'ADD_ON'
            ? 'ADD_ON'
            : 'SPECIAL',
        title:
          rule.scope.targetRole === 'SERGEANT'
            ? `Unit Leader Loadout (${rule.replaces ? `Replaces ${rule.replaces.name}` : 'Option'})`
            : rule.ruleType === 'ADD_ON'
            ? 'Optional Squad Equipment'
            : `Special & Heavy Weapons (${rule.scope.scaleFactor ? `1 per ${rule.scope.scaleFactor} models` : `Max ${maxAllowed}`})`,
        replacesName: rule.replaces?.name,
        scaleFactor: rule.scope.scaleFactor,
        maxAllowed,
        options: rule.options,
      };

      if (slot.category === 'LEADER') {
        leaderSlots.push(slot);
      } else if (slot.category === 'ADD_ON') {
        addOnSlots.push(slot);
      } else {
        squadSpecialSlots.push(slot);
      }
    }
  }

  // ── Fallback & Supplemental Generation from Catalog Weapons & Abilities ──
  // Group weapons by normalized base name to eliminate firing mode duplicates (e.g. frag/krak, standard/supercharge)
  const uniqueWeaponBaseMap = new Map<string, WeaponProfile>();
  for (const w of catalogWeapons) {
    const baseName = normalizeBaseWeaponName(w.name);
    if (!uniqueWeaponBaseMap.has(baseName)) {
      uniqueWeaponBaseMap.set(baseName, { ...w, name: baseName });
    }
  }
  const distinctWeapons = Array.from(uniqueWeaponBaseMap.values());

  const rangedWeapons = distinctWeapons.filter(w => !isMelee(w) && !isPistol(w));
  const pistolWeapons = distinctWeapons.filter(w => isPistol(w));
  const meleeWeapons = distinctWeapons.filter(w => isMelee(w));

  if (isLeader) {
    // ── Leader / Character Armament ─────────────────────────────────────────
    // Primary Ranged Options
    if (rangedWeapons.length > 1 && !leaderSlots.some(s => s.id === 'slot_leader_ranged')) {
      const baseRanged = rangedWeapons[0]!;
      leaderSlots.push({
        id: 'slot_leader_ranged',
        ruleId: 'rule_fallback_leader_ranged',
        category: 'LEADER',
        title: `Primary Ranged Weapon`,
        replacesName: baseRanged.name,
        maxAllowed: 1,
        options: rangedWeapons.slice(1).map(w => ({
          id: slugify(w.name),
          name: w.name,
          count: 1,
          pointsDelta: 0,
        })),
      });
    }

    // Pistol / Sidearm Options
    if (pistolWeapons.length > 1 && !leaderSlots.some(s => s.id === 'slot_leader_pistol')) {
      const basePistol = pistolWeapons[0]!;
      leaderSlots.push({
        id: 'slot_leader_pistol',
        ruleId: 'rule_fallback_leader_pistol',
        category: 'LEADER',
        title: `Sidearm / Pistol Upgrade`,
        replacesName: basePistol.name,
        maxAllowed: 1,
        options: pistolWeapons.slice(1).map(w => ({
          id: slugify(w.name),
          name: w.name,
          count: 1,
          pointsDelta: 0,
        })),
      });
    }

    // Melee Weapon Options
    if (meleeWeapons.length > 1 && !leaderSlots.some(s => s.id === 'slot_leader_melee')) {
      const baseMelee = meleeWeapons[0]!;
      leaderSlots.push({
        id: 'slot_leader_melee',
        ruleId: 'rule_fallback_leader_melee',
        category: 'LEADER',
        title: `Melee Weapon Selection`,
        replacesName: baseMelee.name,
        maxAllowed: 1,
        options: meleeWeapons.slice(1).map(w => ({
          id: slugify(w.name),
          name: w.name,
          count: 1,
          pointsDelta: 0,
        })),
      });
    }
  } else {
    // ── Squad Loadout ───────────────────────────────────────────────────────
    // 1. Leader / Sergeant Melee Upgrades
    const baseTroopMelee = meleeWeapons.find(w =>
      /close combat|fist|bayonet|claws|knife/i.test(w.name)
    ) || meleeWeapons[0];
    const sergeantMeleeOptions = meleeWeapons.filter(w => w !== baseTroopMelee);

    if (sergeantMeleeOptions.length > 0 && baseTroopMelee && !leaderSlots.some(s => s.id === 'slot_sergeant_melee')) {
      leaderSlots.push({
        id: 'slot_sergeant_melee',
        ruleId: 'rule_fallback_sergeant_melee',
        category: 'LEADER',
        title: 'Sergeant Melee Upgrade',
        replacesName: baseTroopMelee.name,
        maxAllowed: 1,
        options: sergeantMeleeOptions.map(w => ({
          id: slugify(w.name),
          name: w.name,
          count: 1,
          pointsDelta: 0,
        })),
      });
    }

    // 2. Leader / Sergeant Pistol Upgrades
    if (pistolWeapons.length > 1 && !leaderSlots.some(s => s.id === 'slot_sergeant_pistol')) {
      const baseTroopPistol = pistolWeapons[0]!;
      const sergeantPistolOptions = pistolWeapons.filter(w => w !== baseTroopPistol);
      if (sergeantPistolOptions.length > 0) {
        leaderSlots.push({
          id: 'slot_sergeant_pistol',
          ruleId: 'rule_fallback_sergeant_pistol',
          category: 'LEADER',
          title: 'Sergeant Sidearm Upgrade',
          replacesName: baseTroopPistol.name,
          maxAllowed: 1,
          options: sergeantPistolOptions.map(w => ({
            id: slugify(w.name),
            name: w.name,
            count: 1,
            pointsDelta: 0,
          })),
        });
      }
    }

    // 3. Squad Special & Heavy Ranged Weapons
    const primaryRanged = rangedWeapons.find(w =>
      /bolt|rifle|gun|lasgun|slugga|fleshborer/i.test(w.name)
    ) || rangedWeapons[0];

    const specialHeavyRanged = rangedWeapons.filter(w => w !== primaryRanged);

    if (specialHeavyRanged.length > 0 && primaryRanged && !squadSpecialSlots.some(s => s.id === 'slot_squad_special')) {
      const isHeavySquad = /devastator|havoc|retributor|eradicator|inceptor/i.test(unitName);
      const scaleFactor = isHeavySquad ? 1 : 5;
      const maxSpecial = isHeavySquad
        ? Math.min(4, Math.max(1, modelCount - 1))
        : Math.max(1, Math.floor(modelCount / 5));

      squadSpecialSlots.push({
        id: 'slot_squad_special',
        ruleId: 'rule_fallback_squad_special',
        category: 'SPECIAL',
        title: isHeavySquad
          ? `Heavy Weapons (Max ${maxSpecial})`
          : `Special & Heavy Weapons (Max 1 per 5 models)`,
        replacesName: primaryRanged.name,
        scaleFactor,
        maxAllowed: maxSpecial,
        options: specialHeavyRanged.map(w => ({
          id: slugify(w.name),
          name: w.name,
          count: 1,
          pointsDelta: 0,
        })),
      });
    }

    // 4. Squad Melee Upgrades (e.g. Terminators taking Chainfists instead of Power fists, or Legionaries melee options)
    if (meleeWeapons.length > 1 && baseTroopMelee && !squadSpecialSlots.some(s => s.id === 'slot_squad_melee')) {
      const squadMeleeOptions = meleeWeapons.filter(w => w !== baseTroopMelee);

      if (squadMeleeOptions.length > 0) {
        squadSpecialSlots.push({
          id: 'slot_squad_melee',
          ruleId: 'rule_fallback_squad_melee',
          category: 'SPECIAL',
          title: `Squad Melee Options (${baseTroopMelee.name} Swaps)`,
          replacesName: baseTroopMelee.name,
          scaleFactor: 1,
          maxAllowed: modelCount,
          options: squadMeleeOptions.map(w => ({
            id: slugify(w.name),
            name: w.name,
            count: 1,
            pointsDelta: 0,
          })),
        });
      }
    }
  }

  // ── 5. Support Wargear & Equipment (Add-on Slots) ──────────────────────────
  // Extract recognized support equipment / tokens from unit abilities
  const SUPPORT_WARGEAR_REGEX =
    /teleport homer|chaos icon|icon of chaos|icon of flame|icon of despair|narthecium|astartes banner|chapter banner|vox-caster|praesidium protectiva|storm shield|combat shield|watcher in the dark|armorium cherub|infiltrator comms array|comms array|helix gauntlet|haywire mine|omni-scrambler|shield drone|marker drone|gun drone|cyber-mastiff|servo-arm|camo cloak|medipack|spectral scanner|pan-spectral scanner|relic shield|simulacrum imperialis|resurrection orb|plasmacyte/i;

  const foundSupportItems: { id: string; name: string }[] = [];

  for (const ab of abilities) {
    if (SUPPORT_WARGEAR_REGEX.test(ab.name) || /token|equipment|bearer's unit|wargear/i.test(ab.description)) {
      const cleanName = ab.name.trim();
      const sId = slugify(cleanName);
      if (!foundSupportItems.some(i => i.id === sId)) {
        foundSupportItems.push({ id: sId, name: cleanName });
      }
    }
  }

  // Also check for auxiliary carapace/vehicle weapons
  for (const w of distinctWeapons) {
    if (/hunter-killer|cyclone missile|pintle|storm bolter \(pintle\)|ironhail heavy stubber|havoc launcher/i.test(w.name)) {
      const sId = slugify(w.name);
      if (!foundSupportItems.some(i => i.id === sId)) {
        foundSupportItems.push({ id: sId, name: w.name });
      }
    }
  }

  // Canonical tabletop 40k support equipment derived from unit keywords & name
  const lowerUnitName = (unitName || '').toLowerCase();
  const kwList = (keywords || []).map(k => k.toLowerCase());

  // Chaos infantry: Chaos Icon
  if (
    /legionar|chosen|terminator|havoc|raptor|biker|possessed/i.test(lowerUnitName) &&
    (/chaos/i.test(lowerUnitName) || kwList.some(k => k.includes('heretic') || k.includes('chaos')))
  ) {
    const sId = 'chaos-icon';
    if (!foundSupportItems.some(i => i.id === sId)) {
      foundSupportItems.push({ id: sId, name: 'Chaos Icon' });
    }
  }

  // Space Marine / Imperium Terminators: Teleport Homer
  if (
    /terminator/i.test(lowerUnitName) &&
    !kwList.some(k => k.includes('heretic') || k.includes('chaos'))
  ) {
    const sId = 'teleport-homer';
    if (!foundSupportItems.some(i => i.id === sId)) {
      foundSupportItems.push({ id: sId, name: 'Teleport Homer' });
    }
  }

  // Space Marine Infiltrators: Helix Gauntlet & Infiltrator Comms Array
  if (/infiltrator/i.test(lowerUnitName)) {
    if (!foundSupportItems.some(i => i.id === 'helix-gauntlet')) {
      foundSupportItems.push({ id: 'helix-gauntlet', name: 'Helix Gauntlet' });
    }
    if (!foundSupportItems.some(i => i.id === 'infiltrator-comms-array')) {
      foundSupportItems.push({ id: 'infiltrator-comms-array', name: 'Infiltrator Comms Array' });
    }
  }

  // Space Marine Incursors: Haywire Mine
  if (/incursor/i.test(lowerUnitName)) {
    if (!foundSupportItems.some(i => i.id === 'haywire-mine')) {
      foundSupportItems.push({ id: 'haywire-mine', name: 'Haywire Mine' });
    }
  }

  // Astra Militarum / Imperial Guard: Vox-caster, Medi-pack
  if (/shock troop|infantry squad|kasrkin|scion|cadian/i.test(lowerUnitName)) {
    if (!foundSupportItems.some(i => i.id === 'vox-caster')) {
      foundSupportItems.push({ id: 'vox-caster', name: 'Vox-caster' });
    }
    if (!foundSupportItems.some(i => i.id === 'medi-pack')) {
      foundSupportItems.push({ id: 'medi-pack', name: 'Medi-pack' });
    }
  }

  // Adepta Sororitas / Battle Sisters: Simulacrum Imperialis
  if (/sister|celestian|retributor|dominion/i.test(lowerUnitName)) {
    if (!foundSupportItems.some(i => i.id === 'simulacrum-imperialis')) {
      foundSupportItems.push({ id: 'simulacrum-imperialis', name: 'Simulacrum Imperialis' });
    }
  }

  // Leagues of Votann Hearthkyn: Medipack, Pan-spectral Scanner
  if (/hearthkyn/i.test(lowerUnitName)) {
    if (!foundSupportItems.some(i => i.id === 'medipack')) {
      foundSupportItems.push({ id: 'medipack', name: 'Medipack' });
    }
    if (!foundSupportItems.some(i => i.id === 'pan-spectral-scanner')) {
      foundSupportItems.push({ id: 'pan-spectral-scanner', name: 'Pan-spectral Scanner' });
    }
  }

  if (foundSupportItems.length > 0 && !addOnSlots.some(s => s.id === 'slot_support_wargear')) {
    addOnSlots.push({
      id: 'slot_support_wargear',
      ruleId: 'rule_support_wargear',
      category: 'ADD_ON',
      title: 'Support Equipment & Wargear',
      maxAllowed: foundSupportItems.length,
      options: foundSupportItems.map(item => ({
        id: item.id,
        name: item.name,
        count: 1,
        pointsDelta: 0,
      })),
    });
  }

  return { leaderSlots, squadSpecialSlots, addOnSlots };
}

/**
 * Resolves equipped weapons for Battle Mode display.
 * Returns only actively equipped weapons with their model counts, properly expanding
 * multi-profile firing modes and tracking weapon swaps.
 */
export function resolveEquippedWeapons(
  catalogWeapons: WeaponProfile[] = [],
  modelCount: number = 1,
  selections: WargearSelection[] = [],
  isLeader: boolean = false
): EquippedWeaponBadge[] {
  if (!catalogWeapons || catalogWeapons.length === 0) return [];

  const norm = (s: string) => s.trim().toLowerCase();
  const isMelee = (w: WeaponProfile) =>
    w.type?.toLowerCase() === 'melee' || w.range?.toLowerCase() === 'melee';
  const isPistol = (w: WeaponProfile) =>
    w.keywords?.some(k => k.toLowerCase() === 'pistol') ||
    w.name.toLowerCase().includes('pistol') ||
    w.name.toLowerCase().includes('hand flamer');

  // Baseline weapons map: key is normalized exact profile name
  const weaponCounts = new Map<string, { profile: WeaponProfile; count: number; role?: string }>();

  if (isLeader) {
    // For a single character, base loadout is 1 of each default weapon
    const primaryRanged = catalogWeapons.find(w => !isMelee(w) && !isPistol(w)) || catalogWeapons[0];
    const melee = catalogWeapons.find(w => isMelee(w));
    const pistol = catalogWeapons.find(w => isPistol(w));

    if (primaryRanged) weaponCounts.set(norm(primaryRanged.name), { profile: primaryRanged, count: 1, role: 'Leader' });
    if (melee && melee !== primaryRanged) weaponCounts.set(norm(melee.name), { profile: melee, count: 1, role: 'Leader' });
    if (pistol && pistol !== primaryRanged && pistol !== melee) weaponCounts.set(norm(pistol.name), { profile: pistol, count: 1, role: 'Leader' });

    if (weaponCounts.size === 0) {
      for (const w of catalogWeapons) {
        weaponCounts.set(norm(w.name), { profile: w, count: 1, role: 'Leader' });
      }
    }
  } else {
    // Squad: standard distribution
    const primaryRanged = catalogWeapons.find(w => !isMelee(w) && !isPistol(w));
    const melee = catalogWeapons.find(w => isMelee(w));
    const pistol = catalogWeapons.find(w => isPistol(w));

    if (primaryRanged) {
      weaponCounts.set(norm(primaryRanged.name), { profile: primaryRanged, count: modelCount, role: 'Trooper' });
    }
    if (melee) {
      weaponCounts.set(norm(melee.name), { profile: melee, count: modelCount, role: 'Trooper' });
    }
    if (pistol) {
      weaponCounts.set(norm(pistol.name), { profile: pistol, count: modelCount, role: 'Trooper' });
    }

    if (weaponCounts.size === 0) {
      for (const w of catalogWeapons) {
        weaponCounts.set(norm(w.name), { profile: w, count: 1, role: 'Chassis' });
      }
    }
  }

  // Apply active wargear selections
  for (const sel of selections) {
    if (!sel || !sel.weaponName || sel.count <= 0) continue;

    // Skip non-weapon support equipment (e.g. Chaos Icon, Teleport Homer) unless it has a weapon profile in catalogWeapons
    if (sel.role === 'ADD_ON' || sel.ruleId === 'rule_addon' || sel.ruleId === 'rule_support_wargear' || sel.ruleId?.includes('support')) {
      const hasCatalogWeapon = catalogWeapons.some(w => norm(w.name || '').includes(norm(sel.weaponName || '')) || norm(sel.weaponName || '').includes(norm(w.name || '')));
      if (!hasCatalogWeapon) {
        continue;
      }
    }

    // Deduct replaced weapon (unless it's an add-on item)
    if (sel.replacesWeaponName && sel.role !== 'ADD_ON') {
      const repKey = norm(sel.replacesWeaponName);
      let matched = false;
      for (const [key, val] of weaponCounts.entries()) {
        const normKey = norm(normalizeBaseWeaponName(key));
        if (normKey === repKey || key === repKey || key.includes(repKey) || repKey.includes(key)) {
          val.count = Math.max(0, val.count - sel.count);
          matched = true;
          break;
        }
      }
      if (!matched && !isLeader) {
        // Fallback: deduct from primary ranged if replacement didn't match
        const primaryRanged = catalogWeapons.find(w => !isMelee(w) && !isPistol(w));
        if (primaryRanged) {
          const val = weaponCounts.get(norm(primaryRanged.name));
          if (val) val.count = Math.max(0, val.count - sel.count);
        }
      }
    }

    // Add selected weapon profile(s)
    // A single weapon choice (like Cyclone missile launcher or Plasma pistol) can have multiple firing profiles
    const baseSelName = normalizeBaseWeaponName(sel.weaponName);
    const selWeaponName = sel.weaponName;
    const matchingProfiles = catalogWeapons.filter(w => {
      const wBase = normalizeBaseWeaponName(w.name || '');
      return norm(wBase) === norm(baseSelName) || (w.name ? norm(w.name) === norm(selWeaponName) : false);
    });

    if (matchingProfiles.length > 0) {
      for (const profile of matchingProfiles) {
        const pKey = norm(profile.name);
        const existing = weaponCounts.get(pKey);
        if (existing) {
          existing.count += sel.count;
        } else {
          weaponCounts.set(pKey, {
            profile,
            count: sel.count,
            role: sel.role || (isLeader ? 'Leader' : 'Trooper'),
          });
        }
      }
    } else {
      // Synthesize profile if not directly found in catalog
      const synthProfile: WeaponProfile = {
        id: slugify(sel.weaponName),
        slug: slugify(sel.weaponName),
        name: sel.weaponName,
        type: 'Ranged',
        range: '24"',
        attacks: '1',
        skill: '3+',
        strength: 4,
        armorPenetration: 0,
        damage: '1',
        keywords: [],
      };
      weaponCounts.set(norm(sel.weaponName), {
        profile: synthProfile,
        count: sel.count,
        role: sel.role || (isLeader ? 'Leader' : 'Trooper'),
      });
    }
  }

  // Filter out any weapon with count <= 0
  const equipped: EquippedWeaponBadge[] = [];
  for (const [, item] of weaponCounts.entries()) {
    if (item.count > 0) {
      const cleanName = cleanDisplayName(item.profile.name);
      equipped.push({
        name: cleanName,
        displayName: `${item.count}x ${cleanName}`,
        count: item.count,
        type: item.profile.type || 'Ranged',
        range: item.profile.range || '24"',
        attacks: item.profile.attacks || '1',
        skill: item.profile.skill || '3+',
        strength: item.profile.strength || 4,
        armorPenetration: item.profile.armorPenetration || 0,
        damage: item.profile.damage || '1',
        keywords: item.profile.keywords || [],
        role: item.role,
      });
    }
  }

  // Sort: Ranged first, then Melee
  equipped.sort((a, b) => {
    const isMeleeA = a.type.toLowerCase() === 'melee' || a.range.toLowerCase() === 'melee';
    const isMeleeB = b.type.toLowerCase() === 'melee' || b.range.toLowerCase() === 'melee';
    if (isMeleeA && !isMeleeB) return 1;
    if (!isMeleeA && isMeleeB) return -1;
    return a.name.localeCompare(b.name);
  });

  return equipped;
}

