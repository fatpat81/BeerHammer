// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Playwright End-to-End Test Suite (§5.1)
// Critical user journeys: Authentication, Army Creation, Studio, Console, Catalog
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('ForceOrg-40k Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Journey starts on the login gate; Quick Launch with a callsign
    // mirrors the documented "Instant Commander Access" flow.
    await page.goto('/');
    await expect(page.locator('text=Instant Commander Access')).toBeVisible();
    await page.fill('input[placeholder*="Callsign"]', 'Captain Titus');
    await page.click('button:has-text("Enter ForceOrg")');
    // Dashboard header must appear once the guest session is active
    await expect(page.locator('text=BeerHammer').or(page.locator('text=Command Nexus')).first()).toBeVisible();
  });

  test('01: Guest login reaches the Command Nexus dashboard', async ({ page }) => {
    await expect(page).toHaveTitle(/BeerHammer|ForceOrg/i);
    const heading = page.locator('text=Command Nexus').or(page.locator('text=BeerHammer')).or(page.locator('text=ForceOrg-40k'));
    await expect(heading.first()).toBeVisible();
  });

  test('02: Can navigate to Datasheet Catalog and search units', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/catalog/);

    // Search for Terminator
    const searchInput = page.locator('input[placeholder*="Search datasheets"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Terminator');

    // Verify Terminator Squad card is visible
    await expect(page.locator('text=Terminator Squad').first()).toBeVisible();

    // Click on card to open detail modal
    await page.locator('text=Terminator Squad').first().click();
    await expect(page.locator('text=Unit Composition')).toBeVisible();

    // Close modal
    await page.click('text=Close');
  });

  test('03: Can navigate to Rules Changelog and view MFM points diffs', async ({ page }) => {
    await page.goto('/changelog');
    await expect(page).toHaveURL(/\/changelog/);

    // Verify Active Ruleset version badge
    await expect(page.locator('h1:has-text("Active Ruleset:")')).toBeVisible();
    await expect(page.locator('text=Terminator Squad').first()).toBeVisible();
    await expect(page.locator('text=Points Reductions').first()).toBeVisible();
  });

  test('04: Tabletop Console functions with wound tracker and stratagems', async ({ page }) => {
    // Open the default demo army console from its army card
    const consoleBtn = page.locator('a:has-text("Battle Mode")').or(page.locator('a:has-text("Console")')).first();
    await expect(consoleBtn).toBeVisible({ timeout: 15000 });
    await consoleBtn.click();
    await expect(page).toHaveURL(/\/army\/.+/, { timeout: 15000 });

    // Verify Battle Mode HUD is visible
    await expect(page.locator('text=BATTLE MODE').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Command Points').first()).toBeVisible();

    // Verify Unit Card and stats are visible: the active unit's name in accordion
    const unitCard = page.locator('text=Captain in Terminator Armour').first();
    await expect(unitCard).toBeVisible({ timeout: 15000 });

    // Click to expand unit accordion
    await unitCard.click();

    // Verify In-Card Stratagems or Phase Statline is visible
    await expect(
      page.locator('text=Legal COMMAND Stratagems')
        .or(page.locator('text=Command Re-roll'))
        .or(page.locator('text=Active COMMAND Statline'))
        .first()
    ).toBeVisible();
  });

  test('05: Rules Audit Modal checks 11th Edition compliance', async ({ page }) => {
    // Open Audit from dashboard or console
    const auditBtn = page.locator('button:has-text("Audit")').or(page.locator('button[title*="Audit"]')).first();
    await expect(auditBtn).toBeVisible({ timeout: 15000 });
    await auditBtn.click();

    // Check audit modal contents
    await expect(page.locator('text=Rules Compliance Audit')).toBeVisible();
    await expect(page.locator('text=Battle-Ready').or(page.locator('text=Advisory Warnings')).or(page.locator('text=Action Required'))).toBeVisible();

    // Close modal
    await page.click('text=Dismiss');
  });
});
