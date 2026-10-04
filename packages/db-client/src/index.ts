// Re-export Prisma client for use across the monorepo
export { PrismaClient } from '@prisma/client';
export type {
  UserProfile,
  UserColorScheme,
  PaintSwatch,
  Datasheet,
  LeaderCompatibility,
  WargearRule,
  Weapon,
  DatasheetWeapon,
  Ability,
  Stratagem,
  UserArmy,
  UserUnitMedia,
  SyncMetadata,
} from '@prisma/client';

export {
  BattlefieldRole,
  WargearRuleType,
  TargetRole,
  AbilitySource,
  BattlePhase,
  StratagemCategory,
} from '@prisma/client';
