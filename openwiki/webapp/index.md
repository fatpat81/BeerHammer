---
type: Documentation Index
title: "Webapp"
description: "Files and subdirectories in Webapp."
---

# Files

- [Api client fallback layer](api-client-fallback-layer.md)
- [Web App Shell, Routing & Guest Session](app-shell-and-guest-session.md) - How the Next.js 14 App Router frontend in apps/web is wired: the root shell that wraps every route in ErrorBoundary + AuthProvider, the client-only route table, and the callsign guest session that persists in localStorage under forceorg_local_user while Supabase remains an optional legacy path.
- [Roster Builder, Battle Mode Console & Force Components](console-and-builder-components.md) - Component inventory for the two force-facing modes of apps/web: the Roster Studio edit route (RosterBuilder with static faction-catalog loading, staged multi-detachment 3 DP budget tray, enhancements, leader attachment, auto-save) and the Battle Mode console route (/army/[id]: phase bar, CP generator, single-accordion force org, in-card stratagems), plus ComplianceDashboard, CreateArmyModal (multi-detachment DP selection) and the orphaned CompositeUnitCard/StratagemPanel/PhotoUploadModal trio.
- [Faction Theme System & Chapter Heraldry](ui-theme-and-heraldry.md) - How @forceorg/ui-theme turns a roster.factionThemeOverride key into a Dawn of War 4-channel colour palette and chapter SVG insignia: the FactionPalette and ChapterPathDefinition contracts, ThemeProvider controlled/uncontrolled themeKey and CSS custom-property injection, and the palette/heraldry registries every apps/web page consumes.
