// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Wargear AST Parser (§7.1)
// Compiles natural-language wargear option text into structured ASTs
// ─────────────────────────────────────────────────────────────────────────────

import type { WargearRuleAST, TargetRole, ConsumedSlot } from '@forceorg/types';

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
