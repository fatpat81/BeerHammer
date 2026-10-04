-- ─────────────────────────────────────────────────────────────────────────────
-- ForceOrg-40k — Row-Level Security Policies
-- Applied after initial migration to enforce multi-tenant data isolation
-- ─────────────────────────────────────────────────────────────────────────────

-- User Armies: Only the owning user can read/write their army lists
ALTER TABLE user_armies ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_army_isolation ON user_armies
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Unit Media: Only the owning user can manage their miniature photos
ALTER TABLE user_unit_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_unit_media_owner ON user_unit_media
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Color Schemes: Only the owning user can manage custom heraldry palettes
ALTER TABLE user_color_schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_color_scheme_isolation ON user_color_schemes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read access for global rules data (datasheets, weapons, stratagems, etc.)
-- These tables do NOT have RLS enabled — they are publicly readable.
-- Write access is restricted to the sync-worker service role only.
COMMENT ON TABLE datasheets_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE weapons_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE abilities_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE stratagems_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE wargear_rules_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE leader_compatibility_11e IS 'Public read. Write restricted to sync-worker service role.';
COMMENT ON TABLE paint_swatches IS 'Public read. Write restricted to admin/sync-worker.';
