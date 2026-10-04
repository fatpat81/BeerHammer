// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k Shared Type Definitions
// Warhammer 40,000 11th Edition
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type BattlefieldRole =
  | 'CHARACTER'
  | 'BATTLELINE'
  | 'INFANTRY'
  | 'MOUNTED'
  | 'MONSTER'
  | 'VEHICLE'
  | 'DEDICATED_TRANSPORT'
  | 'FORTIFICATION'
  | 'ALLIED_UNIT';

export type WargearRuleType = 'REPLACE' | 'ADD_ON' | 'SQUAD_SYNC' | 'PAIR_LINK';

export type TargetRole = 'SERGEANT' | 'TROOPER' | 'CHASSIS' | 'ANY';

export type AbilitySource = 'BODYGUARD' | 'LEADER' | 'ENHANCEMENT' | 'DETACHMENT' | 'CORE';

export type BattlePhase = 'COMMAND' | 'MOVEMENT' | 'SHOOTING' | 'CHARGE' | 'FIGHT' | 'ANY';

export type StratagemCategory = 'CORE' | 'DETACHMENT';

// ── Datasheet & Unit Types ───────────────────────────────────────────────────

export interface ModelComposition {
  name: string;
  count?: number;
  min?: number;
  max?: number;
  baseSize: string;
}

export interface UnitComposition {
  models: ModelComposition[];
}

export interface DatasheetStats {
  movement: string;
  toughness: number;
  save: string;
  invulnerableSave?: string;
  leadership: string;
  objectiveControl: number;
}

export interface Datasheet {
  id: string;
  factionId: string;
  name: string;
  battlefieldRole: BattlefieldRole;
  basePoints: number;
  detachmentPointsCost: number;
  unitComposition: UnitComposition;
  stats: DatasheetStats;
  keywords: string[];
  chapterLock?: string | null;
  isAlliedEligible: boolean;
  alliedFactionGroup?: string | null;
  canonicalImageUrl: string;
  canonicalThumbUrl: string;
}

// ── Weapon Types ─────────────────────────────────────────────────────────────

export interface WeaponProfile {
  id: string;
  slug: string;
  name: string;
  type: string;
  range: string;
  attacks: string;
  skill: string;
  strength: number;
  armorPenetration: number;
  damage: string;
  firingMode?: string | null;
  keywords: string[];
}

export interface DatasheetWeapon {
  id: string;
  datasheetId: string;
  weaponId: string;
  isDefault: boolean;
  weapon?: WeaponProfile;
}

// ── Ability & Stratagem Types ────────────────────────────────────────────────

export interface Ability {
  id: string;
  datasheetId?: string | null;
  name: string;
  source: AbilitySource;
  phase?: BattlePhase | null;
  description: string;
}

export interface Stratagem {
  id: string;
  name: string;
  category: StratagemCategory;
  detachmentId?: string | null;
  factionId?: string | null;
  cpCost: number;
  phase: BattlePhase;
  description: string;
  requiredKeywords: string[];
}

// ── Wargear AST Types ────────────────────────────────────────────────────────

export type ConsumedSlot = 'primary_ranged' | 'secondary_ranged' | 'melee' | 'chassis_addon';

export interface WargearOption {
  id: string;
  name: string;
  count: number;
  pointsDelta: number;
}

export interface WargearRuleAST {
  id: string;
  rawText: string;
  ruleType: WargearRuleType;
  scope: {
    targetRole: TargetRole;
    rawRoleName?: string;
    scaleFactor?: number;
    modelLimit?: number | 'ALL';
  };
  replaces?: { name: string; count: number };
  options: WargearOption[];
  constraint: {
    maxSelections: number | string;
    consumedSlots: ConsumedSlot[];
    isMutuallyExclusive: boolean;
  };
}

// ── Leader / Attachment Types ────────────────────────────────────────────────

export interface LeaderCompatibility {
  id: string;
  leaderDatasheetId: string;
  bodyguardDatasheetId: string;
}

export interface CompositeUnit {
  leader: Datasheet;
  bodyguard: Datasheet;
  combinedKeywords: string[];
  effectiveToughness: number;
  mergedWeapons: WeaponProfile[];
  mergedAbilities: Ability[];
}

// ── Roster & Army Types ──────────────────────────────────────────────────────

export interface RosterUnitInstance {
  instanceId: string;
  datasheetId: string;
  datasheetName: string;
  modelCount: number;
  attachedLeaderId?: string | null;
  wargearSelections: WargearSelection[];
  pointsCost: number;
  customImageUrl?: string | null;
}

export interface WargearSelection {
  ruleId: string;
  selectedOptionId: string;
  count: number;
}

export interface RosterPayload {
  units: RosterUnitInstance[];
  totalPoints: number;
  detachmentPointsUsed: number;
}

export interface UserArmy {
  id: string;
  userId: string;
  name: string;
  factionId: string;
  rulesetVersionId: string;
  detachmentPrimary: string;
  detachmentSecondary?: string | null;
  pointsLimit: number;
  detachmentPointsLimit: number;
  factionThemeOverride?: string | null;
  rosterPayload: RosterPayload;
  createdAt: string;
  updatedAt: string;
}

// ── Model Health (View Mode) ─────────────────────────────────────────────────

export interface ModelHealth {
  id: string;
  modelName: string;
  isLeader: boolean;
  maxWounds: number;
  currentWounds: number;
}

// ── Audit / Discrepancy Types ────────────────────────────────────────────────

export type DiscrepancySeverity = 'AMBER' | 'RED';

export interface RosterDiscrepancy {
  unitInstanceId: string;
  unitName: string;
  severity: DiscrepancySeverity;
  category: 'POINTS_SHIFT' | 'INVALID_LOADOUT' | 'KEYWORD_CHANGE' | 'DP_VIOLATION';
  message: string;
  oldValue?: string;
  newValue?: string;
}

export interface AuditResult {
  rosterId: string;
  rulesetVersionCompared: string;
  discrepancies: RosterDiscrepancy[];
  isCompliant: boolean;
  auditedAt: string;
}

// ── Theme & Heraldry Types ───────────────────────────────────────────────────

export interface FactionPalette {
  key: string;
  name: string;
  primary: string;
  secondary: string;
  trim: string;
  detail: string;
  glow: string;
}

export interface ChapterPathDefinition {
  name: string;
  viewBox: string;
  paths: { d: string; fill?: string; opacity?: number }[];
}

// ── Media Types ──────────────────────────────────────────────────────────────

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ProcessedMiniaturePayload {
  cardImage: ProcessedImageResult;
  thumbnail: ProcessedImageResult;
}

export interface UserUnitMedia {
  id: string;
  userId: string;
  rosterId: string;
  unitInstanceId: string;
  imageUrl: string;
  thumbnailUrl: string;
  storageKeyPrefix: string;
}

// ── Sync / ETL Types ─────────────────────────────────────────────────────────

export interface SyncMetadata {
  id: string;
  endpoint: string;
  lastModified?: string | null;
  etag?: string | null;
  contentHash: string;
  rulesetVersionId: string;
  status: 'SUCCESS' | 'NO_DELTA' | 'ERROR' | 'PENDING';
  recordCount: number;
  errorMessage?: string | null;
  syncedAt: string;
}

export interface SyncDelta {
  added: string[];
  modified: string[];
  removed: string[];
  pointChanges: Array<{
    datasheetName: string;
    oldPoints: number;
    newPoints: number;
  }>;
}

// ── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    totalPages?: number;
    totalCount?: number;
  };
}
