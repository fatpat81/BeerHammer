// Rules Engine 11th Edition — Public API
export {
  compileWahapediaWargear,
  slugify,
  parseCountAndName,
  parseOptionList,
  validateWargearLoadout,
  resolveEquippedWeapons,
  buildUnitWargearSlots,
  normalizeBaseWeaponName,
  cleanDisplayName,
  calculateUnitSquadPoints,
  getUnitBaseModelThreshold,
} from './wargear-parser';
export type { WargearSlot } from './wargear-parser';

export {
  isAttachmentValid,
  resolveEffectiveToughness,
  mergeKeywords,
  mergeWeapons,
  mergeAbilities,
  resolveCompositeUnit,
  allocateWound,
  isUnitDestroyed,
  countAliveBodyguards,
} from './attachment-resolver';

export {
  filterStratagems,
  groupStratagemsByCategory,
  unitSatisfiesKeywords,
  isPhaseActive,
} from './stratagem-filter';

export {
  validateRoster,
  validatePointsLimit,
  validateDetachmentPoints,
  validateRuleOfThree,
  validateAttachments,
} from './detachment-validator';

export type { ValidationError } from './detachment-validator';
