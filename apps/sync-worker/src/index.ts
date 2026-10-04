// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Sync Worker Entry Point
// Executed via GitHub Actions cron at 02:00 AM UTC
// ─────────────────────────────────────────────────────────────────────────────

import { runETLPipeline } from './etl-pipeline';

async function main() {
  try {
    await runETLPipeline();
    process.exit(0);
  } catch (err) {
    console.error('[Sync Worker] Fatal error:', err);
    process.exit(1);
  }
}

main();
