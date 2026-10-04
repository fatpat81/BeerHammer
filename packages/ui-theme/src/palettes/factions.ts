// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Dawn of War 4-Channel Faction Palette Registry (§8.1)
// 50+ faction/subfaction palettes across Imperium, Chaos, and Xenos
// ─────────────────────────────────────────────────────────────────────────────

import type { FactionPalette } from '@forceorg/types';

// ── 1. ADEPTUS ASTARTES (Space Marine Chapters) ─────────────────────────────

export const SPACE_MARINE_PALETTES: FactionPalette[] = [
  { key: 'ultramarines', name: 'Ultramarines', primary: '#0B3056', secondary: '#071D36', trim: '#C89D3C', detail: '#DC2626', glow: '#38BDF8' },
  { key: 'blood_angels', name: 'Blood Angels', primary: '#991B1B', secondary: '#581C1C', trim: '#D97706', detail: '#111827', glow: '#22C55E' },
  { key: 'dark_angels', name: 'Dark Angels', primary: '#143823', secondary: '#0D2417', trim: '#D4C391', detail: '#991B1B', glow: '#DC2626' },
  { key: 'space_wolves', name: 'Space Wolves', primary: '#5C768D', secondary: '#3B4D5D', trim: '#CA8A04', detail: '#1F2937', glow: '#67E8F9' },
  { key: 'black_templars', name: 'Black Templars', primary: '#090A0C', secondary: '#181A1E', trim: '#E2E8F0', detail: '#B91C1C', glow: '#EF4444' },
  { key: 'deathwatch', name: 'Deathwatch', primary: '#0F1115', secondary: '#1E222A', trim: '#94A3B8', detail: '#991B1B', glow: '#F97316' },
  { key: 'imperial_fists', name: 'Imperial Fists', primary: '#D97706', secondary: '#92400E', trim: '#DC2626', detail: '#F8FAFC', glow: '#38BDF8' },
  { key: 'iron_hands', name: 'Iron Hands', primary: '#0F1216', secondary: '#1E232B', trim: '#94A3B8', detail: '#F8FAFC', glow: '#60A5FA' },
  { key: 'salamanders', name: 'Salamanders', primary: '#15803D', secondary: '#0E4F26', trim: '#171717', detail: '#F97316', glow: '#F97316' },
  { key: 'raven_guard', name: 'Raven Guard', primary: '#0D0F12', secondary: '#161A20', trim: '#F1F5F9', detail: '#B91C1C', glow: '#DC2626' },
  { key: 'white_scars', name: 'White Scars', primary: '#F8FAFC', secondary: '#CBD5E1', trim: '#DC2626', detail: '#FBBF24', glow: '#FBBF24' },
  { key: 'grey_knights', name: 'Grey Knights', primary: '#64748B', secondary: '#334155', trim: '#E2E8F0', detail: '#B91C1C', glow: '#0EA5E9' },
  { key: 'blood_ravens', name: 'Blood Ravens', primary: '#7F1D1D', secondary: '#450A0A', trim: '#D4C391', detail: '#111827', glow: '#10B981' },
];

// ── 2. CHAOS FACTIONS ────────────────────────────────────────────────────────

export const CHAOS_PALETTES: FactionPalette[] = [
  { key: 'black_legion', name: 'Black Legion', primary: '#0A0C0E', secondary: '#181B20', trim: '#C28B38', detail: '#B91C1C', glow: '#F97316' },
  { key: 'world_eaters', name: 'World Eaters', primary: '#881337', secondary: '#4C0519', trim: '#D97706', detail: '#18181B', glow: '#EF4444' },
  { key: 'death_guard', name: 'Death Guard', primary: '#364032', secondary: '#242B21', trim: '#8C6239', detail: '#713F12', glow: '#84CC16' },
  { key: 'thousand_sons', name: 'Thousand Sons', primary: '#0D5C75', secondary: '#083344', trim: '#D4AF37', detail: '#F59E0B', glow: '#06B6D4' },
  { key: 'emperors_children', name: "Emperor's Children", primary: '#831843', secondary: '#500724', trim: '#E2E8F0', detail: '#F43F5E', glow: '#EC4899' },
  { key: 'iron_warriors', name: 'Iron Warriors', primary: '#475569', secondary: '#1E293B', trim: '#CA8A04', detail: '#090A0C', glow: '#F59E0B' },
  { key: 'night_lords', name: 'Night Lords', primary: '#0A1931', secondary: '#050B14', trim: '#94A3B8', detail: '#991B1B', glow: '#38BDF8' },
  { key: 'word_bearers', name: 'Word Bearers', primary: '#581C1C', secondary: '#330B0B', trim: '#71717A', detail: '#D4D4D8', glow: '#F97316' },
  { key: 'alpha_legion', name: 'Alpha Legion', primary: '#0E7490', secondary: '#083344', trim: '#22C55E', detail: '#64748B', glow: '#06B6D4' },
  { key: 'chaos_daemons_khorne', name: 'Chaos Daemons (Khorne)', primary: '#7F1D1D', secondary: '#450A0A', trim: '#B45309', detail: '#18181B', glow: '#EF4444' },
  { key: 'chaos_daemons_nurgle', name: 'Chaos Daemons (Nurgle)', primary: '#3F4F28', secondary: '#273318', trim: '#785332', detail: '#84CC16', glow: '#A3E635' },
  { key: 'chaos_daemons_tzeentch', name: 'Chaos Daemons (Tzeentch)', primary: '#1E3A8A', secondary: '#0F172A', trim: '#EC4899', detail: '#F59E0B', glow: '#22D3EE' },
  { key: 'chaos_daemons_slaanesh', name: 'Chaos Daemons (Slaanesh)', primary: '#701A75', secondary: '#3B0764', trim: '#F3E8FF', detail: '#D946EF', glow: '#F472B6' },
  { key: 'chaos_knights', name: 'Chaos Knights', primary: '#1C1917', secondary: '#0C0A09', trim: '#78350F', detail: '#991B1B', glow: '#DC2626' },
];

// ── 3. XENOS FACTIONS ────────────────────────────────────────────────────────

export const XENOS_PALETTES: FactionPalette[] = [
  // Necrons
  { key: 'necrons_szarekhan', name: 'Necrons (Szarekhan)', primary: '#1E2328', secondary: '#13181C', trim: '#8C7355', detail: '#334155', glow: '#22C55E' },
  { key: 'necrons_sautekh', name: 'Necrons (Sautekh)', primary: '#334155', secondary: '#1E293B', trim: '#0F172A', detail: '#94A3B8', glow: '#22C55E' },
  { key: 'necrons_mephrit', name: 'Necrons (Mephrit)', primary: '#1C2321', secondary: '#111615', trim: '#A16207', detail: '#166534', glow: '#F97316' },
  { key: 'necrons_novokh', name: 'Necrons (Novokh)', primary: '#881337', secondary: '#4C0519', trim: '#94A3B8', detail: '#0F172A', glow: '#22C55E' },
  { key: 'necrons_nihilakh', name: 'Necrons (Nihilakh)', primary: '#0E7490', secondary: '#083344', trim: '#C89D3C', detail: '#0F172A', glow: '#22C55E' },
  // T'au
  { key: 'tau_tau_sept', name: "T'au (T'au Sept)", primary: '#B45309', secondary: '#78350F', trim: '#475569', detail: '#F8FAFC', glow: '#06B6D4' },
  { key: 'tau_viorla', name: "T'au (Vior'la)", primary: '#F8FAFC', secondary: '#E2E8F0', trim: '#BE123C', detail: '#334155', glow: '#06B6D4' },
  { key: 'tau_farsight', name: "T'au (Farsight Enclaves)", primary: '#991B1B', secondary: '#450A0A', trim: '#475569', detail: '#E2E8F0', glow: '#38BDF8' },
  { key: 'tau_sacea', name: "T'au (Sa'cea)", primary: '#1E3A8A', secondary: '#172554', trim: '#EA580C', detail: '#64748B', glow: '#06B6D4' },
  // Aeldari
  { key: 'aeldari_ulthwe', name: 'Aeldari (Ulthwé)', primary: '#090A0F', secondary: '#151821', trim: '#D4C391', detail: '#7F1D1D', glow: '#06B6D4' },
  { key: 'aeldari_bieltan', name: 'Aeldari (Biel-Tan)', primary: '#F8FAFC', secondary: '#E2E8F0', trim: '#15803D', detail: '#DC2626', glow: '#10B981' },
  { key: 'aeldari_iyanden', name: 'Aeldari (Iyanden)', primary: '#CA8A04', secondary: '#854D0E', trim: '#1E3A8A', detail: '#F8FAFC', glow: '#38BDF8' },
  { key: 'aeldari_saimhann', name: 'Aeldari (Saim-Hann)', primary: '#B91C1C', secondary: '#450A0A', trim: '#F8FAFC', detail: '#090A0C', glow: '#F59E0B' },
  { key: 'aeldari_ynnari', name: 'Aeldari (Ynnari)', primary: '#881337', secondary: '#4C0519', trim: '#090A0C', detail: '#D4C391', glow: '#A855F7' },
  // Drukhari
  { key: 'drukhari_black_heart', name: 'Drukhari (Black Heart)', primary: '#064E3B', secondary: '#022C22', trim: '#18181B', detail: '#991B1B', glow: '#10B981' },
  { key: 'drukhari_strife', name: 'Drukhari (Strife)', primary: '#18181B', secondary: '#090A0C', trim: '#991B1B', detail: '#94A3B8', glow: '#EC4899' },
  // Orks
  { key: 'orks_goffs', name: 'Orks (Goffs)', primary: '#18181B', secondary: '#090A0C', trim: '#DC2626', detail: '#F8FAFC', glow: '#EF4444' },
  { key: 'orks_bad_moons', name: 'Orks (Bad Moons)', primary: '#EAB308', secondary: '#A16207', trim: '#18181B', detail: '#F8FAFC', glow: '#F59E0B' },
  { key: 'orks_evil_sunz', name: 'Orks (Evil Sunz)', primary: '#DC2626', secondary: '#7F1D1D', trim: '#EAB308', detail: '#18181B', glow: '#F97316' },
  { key: 'orks_deathskulls', name: 'Orks (Deathskulls)', primary: '#1D4ED8', secondary: '#1E3A8A', trim: '#090A0C', detail: '#E2E8F0', glow: '#38BDF8' },
  // Tyranids
  { key: 'tyranids_leviathan', name: 'Tyranids (Leviathan)', primary: '#F8FAFC', secondary: '#E2E8F0', trim: '#581C87', detail: '#991B1B', glow: '#A855F7' },
  { key: 'tyranids_kraken', name: 'Tyranids (Kraken)', primary: '#D4C391', secondary: '#A89B74', trim: '#991B1B', detail: '#1E293B', glow: '#EF4444' },
  { key: 'tyranids_behemoth', name: 'Tyranids (Behemoth)', primary: '#1E3A8A', secondary: '#0F172A', trim: '#B91C1C', detail: '#D4C391', glow: '#38BDF8' },
  { key: 'tyranids_kronos', name: 'Tyranids (Kronos)', primary: '#090A0C', secondary: '#18181B', trim: '#EA580C', detail: '#7F1D1D', glow: '#F97316' },
  // Genestealer Cults
  { key: 'gsc_four_armed', name: 'Genestealer Cults (4-Armed Emperor)', primary: '#3B0764', secondary: '#1E1B4B', trim: '#475569', detail: '#EA580C', glow: '#C084FC' },
  { key: 'gsc_rusted', name: 'Genestealer Cults (Rusted Claw)', primary: '#9A3412', secondary: '#431407', trim: '#78350F', detail: '#1E293B', glow: '#FB923C' },
  // Leagues of Votann
  { key: 'votann_gtl', name: 'Votann (Greater Thurian League)', primary: '#1E3A8A', secondary: '#0F172A', trim: '#EA580C', detail: '#E2E8F0', glow: '#38BDF8' },
  { key: 'votann_kronus', name: 'Votann (Kronus Hegemony)', primary: '#991B1B', secondary: '#450A0A', trim: '#EAB308', detail: '#18181B', glow: '#F59E0B' },
  { key: 'votann_ymyr', name: 'Votann (Ymyr Conglomerate)', primary: '#7F1D1D', secondary: '#450A0A', trim: '#CA8A04', detail: '#0284C7', glow: '#38BDF8' },
];

// ── Combined Registry ────────────────────────────────────────────────────────

export const ALL_FACTION_PALETTES: FactionPalette[] = [
  ...SPACE_MARINE_PALETTES,
  ...CHAOS_PALETTES,
  ...XENOS_PALETTES,
];

/**
 * Lookup a faction palette by key. Returns Ultramarines as fallback.
 */
export function getFactionPalette(key: string): FactionPalette {
  return ALL_FACTION_PALETTES.find(p => p.key === key) ?? SPACE_MARINE_PALETTES[0]!;
}

/**
 * Generates CSS custom property declarations for a given palette.
 */
export function paletteToCSSVars(palette: FactionPalette): Record<string, string> {
  return {
    '--c-primary': palette.primary,
    '--c-secondary': palette.secondary,
    '--c-trim': palette.trim,
    '--c-detail': palette.detail,
    '--c-glow': palette.glow,
    '--surface-header': `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
    '--surface-card': palette.secondary,
    '--surface-border': `${palette.trim}33`,
    '--text-primary': '#F8FAFC',
    '--text-secondary': '#94A3B8',
  };
}
