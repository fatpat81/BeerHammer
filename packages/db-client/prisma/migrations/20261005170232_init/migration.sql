-- CreateEnum
CREATE TYPE "BattlefieldRole" AS ENUM ('CHARACTER', 'BATTLELINE', 'INFANTRY', 'MOUNTED', 'MONSTER', 'VEHICLE', 'DEDICATED_TRANSPORT', 'FORTIFICATION', 'ALLIED_UNIT');

-- CreateEnum
CREATE TYPE "WargearRuleType" AS ENUM ('REPLACE', 'ADD_ON', 'SQUAD_SYNC', 'PAIR_LINK');

-- CreateEnum
CREATE TYPE "TargetRole" AS ENUM ('SERGEANT', 'TROOPER', 'CHASSIS', 'ANY');

-- CreateEnum
CREATE TYPE "AbilitySource" AS ENUM ('BODYGUARD', 'LEADER', 'ENHANCEMENT', 'DETACHMENT', 'CORE');

-- CreateEnum
CREATE TYPE "BattlePhase" AS ENUM ('COMMAND', 'MOVEMENT', 'SHOOTING', 'CHARGE', 'FIGHT', 'ANY');

-- CreateEnum
CREATE TYPE "StratagemCategory" AS ENUM ('CORE', 'DETACHMENT');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "callsign" VARCHAR(60) NOT NULL,
    "default_faction_theme" VARCHAR(50) NOT NULL DEFAULT 'ultramarines',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_color_schemes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "faction_key" VARCHAR(50) NOT NULL,
    "subfaction_name" VARCHAR(100),
    "is_canon" BOOLEAN NOT NULL DEFAULT false,
    "palette" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_color_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paint_swatches" (
    "id" UUID NOT NULL,
    "brand" VARCHAR(50) NOT NULL,
    "paint_name" VARCHAR(100) NOT NULL,
    "paint_type" VARCHAR(30) NOT NULL,
    "hex_code" CHAR(7) NOT NULL,
    "finish" VARCHAR(20) NOT NULL DEFAULT 'Matte',

    CONSTRAINT "paint_swatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasheets_11e" (
    "id" UUID NOT NULL,
    "faction_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "battlefield_role" "BattlefieldRole" NOT NULL,
    "base_points" INTEGER NOT NULL,
    "detachment_points_cost" INTEGER NOT NULL DEFAULT 0,
    "unit_composition" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "keywords" TEXT[],
    "chapter_lock" VARCHAR(50),
    "is_allied_eligible" BOOLEAN NOT NULL DEFAULT false,
    "allied_faction_group" VARCHAR(50),
    "canonical_image_url" TEXT NOT NULL DEFAULT '/assets/models/default_placeholder.webp',
    "canonical_thumb_url" TEXT NOT NULL DEFAULT '/assets/models/default_placeholder_thumb.webp',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datasheets_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_compatibility_11e" (
    "id" UUID NOT NULL,
    "leader_datasheet_id" UUID NOT NULL,
    "bodyguard_datasheet_id" UUID NOT NULL,

    CONSTRAINT "leader_compatibility_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wargear_rules_11e" (
    "id" UUID NOT NULL,
    "datasheet_id" UUID NOT NULL,
    "rule_type" "WargearRuleType" NOT NULL,
    "applies_to_role" "TargetRole" NOT NULL,
    "raw_text" TEXT,
    "condition_tree" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wargear_rules_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapons_11e" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "range" VARCHAR(20) NOT NULL,
    "attacks" VARCHAR(20) NOT NULL,
    "skill" VARCHAR(10) NOT NULL,
    "strength" INTEGER NOT NULL,
    "armor_penetration" INTEGER NOT NULL,
    "damage" VARCHAR(20) NOT NULL,
    "firing_mode" VARCHAR(40),
    "keywords" TEXT[],

    CONSTRAINT "weapons_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasheet_weapons_11e" (
    "id" UUID NOT NULL,
    "datasheet_id" UUID NOT NULL,
    "weapon_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "datasheet_weapons_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abilities_11e" (
    "id" UUID NOT NULL,
    "datasheet_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "source" "AbilitySource" NOT NULL,
    "phase" "BattlePhase",
    "description" TEXT NOT NULL,

    CONSTRAINT "abilities_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stratagems_11e" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "StratagemCategory" NOT NULL,
    "detachment_id" VARCHAR(100),
    "faction_id" VARCHAR(50),
    "cp_cost" INTEGER NOT NULL,
    "phase" "BattlePhase" NOT NULL,
    "description" TEXT NOT NULL,
    "required_keywords" TEXT[],

    CONSTRAINT "stratagems_11e_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_armies" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "faction_id" VARCHAR(50) NOT NULL,
    "ruleset_version_id" VARCHAR(60) NOT NULL,
    "detachment_primary" VARCHAR(100) NOT NULL,
    "detachment_secondary" VARCHAR(100),
    "points_limit" INTEGER NOT NULL DEFAULT 2000,
    "detachment_points_limit" INTEGER NOT NULL DEFAULT 3,
    "faction_theme_override" VARCHAR(50),
    "roster_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_armies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_unit_media" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "roster_id" UUID NOT NULL,
    "unit_instance_id" VARCHAR(64) NOT NULL,
    "image_url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "storage_key_prefix" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_unit_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_metadata" (
    "id" UUID NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "last_modified" VARCHAR(100),
    "etag" VARCHAR(100),
    "content_hash" VARCHAR(64) NOT NULL,
    "ruleset_version_id" VARCHAR(60) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_color_schemes_user_id_faction_key_idx" ON "user_color_schemes"("user_id", "faction_key");

-- CreateIndex
CREATE INDEX "paint_swatches_brand_paint_type_idx" ON "paint_swatches"("brand", "paint_type");

-- CreateIndex
CREATE INDEX "datasheets_11e_faction_id_battlefield_role_idx" ON "datasheets_11e"("faction_id", "battlefield_role");

-- CreateIndex
CREATE INDEX "datasheets_11e_chapter_lock_idx" ON "datasheets_11e"("chapter_lock");

-- CreateIndex
CREATE INDEX "leader_compatibility_11e_leader_datasheet_id_idx" ON "leader_compatibility_11e"("leader_datasheet_id");

-- CreateIndex
CREATE INDEX "leader_compatibility_11e_bodyguard_datasheet_id_idx" ON "leader_compatibility_11e"("bodyguard_datasheet_id");

-- CreateIndex
CREATE UNIQUE INDEX "leader_compatibility_11e_leader_datasheet_id_bodyguard_data_key" ON "leader_compatibility_11e"("leader_datasheet_id", "bodyguard_datasheet_id");

-- CreateIndex
CREATE INDEX "wargear_rules_11e_datasheet_id_rule_type_idx" ON "wargear_rules_11e"("datasheet_id", "rule_type");

-- CreateIndex
CREATE UNIQUE INDEX "weapons_11e_slug_key" ON "weapons_11e"("slug");

-- CreateIndex
CREATE INDEX "weapons_11e_slug_idx" ON "weapons_11e"("slug");

-- CreateIndex
CREATE INDEX "datasheet_weapons_11e_datasheet_id_idx" ON "datasheet_weapons_11e"("datasheet_id");

-- CreateIndex
CREATE UNIQUE INDEX "datasheet_weapons_11e_datasheet_id_weapon_id_key" ON "datasheet_weapons_11e"("datasheet_id", "weapon_id");

-- CreateIndex
CREATE INDEX "abilities_11e_datasheet_id_idx" ON "abilities_11e"("datasheet_id");

-- CreateIndex
CREATE INDEX "stratagems_11e_category_phase_idx" ON "stratagems_11e"("category", "phase");

-- CreateIndex
CREATE INDEX "stratagems_11e_detachment_id_idx" ON "stratagems_11e"("detachment_id");

-- CreateIndex
CREATE INDEX "stratagems_11e_faction_id_idx" ON "stratagems_11e"("faction_id");

-- CreateIndex
CREATE INDEX "user_armies_user_id_idx" ON "user_armies"("user_id");

-- CreateIndex
CREATE INDEX "user_armies_ruleset_version_id_idx" ON "user_armies"("ruleset_version_id");

-- CreateIndex
CREATE INDEX "user_unit_media_roster_id_idx" ON "user_unit_media"("roster_id");

-- CreateIndex
CREATE INDEX "user_unit_media_user_id_idx" ON "user_unit_media"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_unit_media_roster_id_unit_instance_id_key" ON "user_unit_media"("roster_id", "unit_instance_id");

-- CreateIndex
CREATE INDEX "sync_metadata_endpoint_synced_at_idx" ON "sync_metadata"("endpoint", "synced_at");

-- AddForeignKey
ALTER TABLE "user_color_schemes" ADD CONSTRAINT "user_color_schemes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_compatibility_11e" ADD CONSTRAINT "leader_compatibility_11e_leader_datasheet_id_fkey" FOREIGN KEY ("leader_datasheet_id") REFERENCES "datasheets_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_compatibility_11e" ADD CONSTRAINT "leader_compatibility_11e_bodyguard_datasheet_id_fkey" FOREIGN KEY ("bodyguard_datasheet_id") REFERENCES "datasheets_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wargear_rules_11e" ADD CONSTRAINT "wargear_rules_11e_datasheet_id_fkey" FOREIGN KEY ("datasheet_id") REFERENCES "datasheets_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasheet_weapons_11e" ADD CONSTRAINT "datasheet_weapons_11e_datasheet_id_fkey" FOREIGN KEY ("datasheet_id") REFERENCES "datasheets_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasheet_weapons_11e" ADD CONSTRAINT "datasheet_weapons_11e_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abilities_11e" ADD CONSTRAINT "abilities_11e_datasheet_id_fkey" FOREIGN KEY ("datasheet_id") REFERENCES "datasheets_11e"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_armies" ADD CONSTRAINT "user_armies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_media" ADD CONSTRAINT "user_unit_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_media" ADD CONSTRAINT "user_unit_media_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "user_armies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
