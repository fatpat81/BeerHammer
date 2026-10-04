// UI Theme — Public API
export { ChapterIcon } from './chapters/ChapterIcon';
export type { ChapterKey, ChapterIconProps } from './chapters/ChapterIcon';
export { CHAPTER_PATHS } from './chapters/paths';
export {
  SPACE_MARINE_PALETTES,
  CHAOS_PALETTES,
  XENOS_PALETTES,
  ALL_FACTION_PALETTES,
  getFactionPalette,
  paletteToCSSVars,
} from './palettes/factions';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemeProviderProps, ThemeContextValue } from './ThemeProvider';
