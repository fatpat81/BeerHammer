// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Wahapedia ETL Pipeline (§5)
// Core orchestration for the daily data ingestion pipeline
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@forceorg/db-client';
import { computeContentHash, hasDelta, extractCacheHeaders } from './checksum';
import { analyzeDiff, formatChangelogSummary } from './diff-analyzer';

const prisma = new PrismaClient();

// Wahapedia endpoints to scrape (placeholder URLs — would be real in production)
const WAHAPEDIA_ENDPOINTS = [
  { key: 'datasheets', url: 'https://wahapedia.ru/wh40k11e/datasheets.json' },
  { key: 'weapons', url: 'https://wahapedia.ru/wh40k11e/weapons.json' },
  { key: 'stratagems', url: 'https://wahapedia.ru/wh40k11e/stratagems.json' },
  { key: 'abilities', url: 'https://wahapedia.ru/wh40k11e/abilities.json' },
];

/**
 * Generates a ruleset version ID based on the current date.
 * Format: 11.1.0-YYYY-QN-MFM
 */
function generateRulesetVersionId(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `11.1.0-${now.getFullYear()}-Q${quarter}-MFM`;
}

/**
 * Fetches data from a single Wahapedia endpoint with ETag/conditional request support.
 */
async function fetchEndpoint(
  endpoint: string,
  storedEtag?: string | null
): Promise<{ data: string; headers: Headers; statusCode: number } | null> {
  const headers: Record<string, string> = {
    'User-Agent': 'ForceOrg-40k-SyncWorker/1.0',
  };

  if (storedEtag) {
    headers['If-None-Match'] = storedEtag;
  }

  try {
    const response = await fetch(endpoint, { headers });

    // 304 Not Modified — no delta
    if (response.status === 304) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    return { data, headers: response.headers, statusCode: response.status };
  } catch (err) {
    console.error(`[ETL] Fetch failed for ${endpoint}:`, err);
    return null;
  }
}

/**
 * Processes a single endpoint: fetches, checks for delta, and logs metadata.
 */
async function processEndpoint(endpointConfig: { key: string; url: string }): Promise<{
  key: string;
  status: 'NO_DELTA' | 'UPDATED' | 'ERROR';
  recordCount: number;
  message?: string;
}> {
  const rulesetVersionId = generateRulesetVersionId();

  // Look up last sync metadata
  const lastSync = await prisma.syncMetadata.findFirst({
    where: { endpoint: endpointConfig.url },
    orderBy: { syncedAt: 'desc' },
  });

  try {
    const result = await fetchEndpoint(endpointConfig.url, lastSync?.etag);

    if (!result) {
      // ETag match or fetch failure — no delta
      await prisma.syncMetadata.create({
        data: {
          endpoint: endpointConfig.url,
          lastModified: lastSync?.lastModified,
          etag: lastSync?.etag,
          contentHash: lastSync?.contentHash || '',
          rulesetVersionId,
          status: 'NO_DELTA',
          recordCount: lastSync?.recordCount || 0,
        },
      });

      return { key: endpointConfig.key, status: 'NO_DELTA', recordCount: 0 };
    }

    // Compute content hash for delta detection
    const contentHash = computeContentHash(result.data);
    const { etag, lastModified } = extractCacheHeaders(result.headers);

    if (!hasDelta(contentHash, lastSync?.contentHash)) {
      await prisma.syncMetadata.create({
        data: {
          endpoint: endpointConfig.url,
          lastModified,
          etag,
          contentHash,
          rulesetVersionId,
          status: 'NO_DELTA',
          recordCount: lastSync?.recordCount || 0,
        },
      });

      return { key: endpointConfig.key, status: 'NO_DELTA', recordCount: 0 };
    }

    // Delta detected — parse and log
    let recordCount = 0;
    try {
      const parsed = JSON.parse(result.data);
      recordCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    } catch {
      recordCount = 0;
    }

    await prisma.syncMetadata.create({
      data: {
        endpoint: endpointConfig.url,
        lastModified,
        etag,
        contentHash,
        rulesetVersionId,
        status: 'SUCCESS',
        recordCount,
      },
    });

    return {
      key: endpointConfig.key,
      status: 'UPDATED',
      recordCount,
      message: `Delta detected. ${recordCount} records ingested.`,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    await prisma.syncMetadata.create({
      data: {
        endpoint: endpointConfig.url,
        contentHash: '',
        rulesetVersionId,
        status: 'ERROR',
        errorMessage,
      },
    });

    return { key: endpointConfig.key, status: 'ERROR', recordCount: 0, message: errorMessage };
  }
}

/**
 * Sends a webhook alert (Discord/Slack) for sync results.
 */
async function sendAlert(summary: string): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `\`\`\`\n${summary}\n\`\`\``,
      }),
    });
  } catch (err) {
    console.error('[ETL] Webhook alert failed:', err);
  }
}

/**
 * Main ETL pipeline orchestrator.
 * Called by GitHub Actions cron or manual workflow dispatch.
 */
export async function runETLPipeline(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ForceOrg-40k — Wahapedia 11th Ed ETL Pipeline  ║');
  console.log('║  Execution Time:', new Date().toISOString(), '    ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const results = [];

  for (const endpoint of WAHAPEDIA_ENDPOINTS) {
    console.log(`\n[ETL] Processing: ${endpoint.key} (${endpoint.url})`);
    const result = await processEndpoint(endpoint);
    results.push(result);

    const icon = result.status === 'UPDATED' ? '🔄' : result.status === 'ERROR' ? '❌' : '✅';
    console.log(`  ${icon} ${result.key}: ${result.status} (${result.recordCount} records)`);
    if (result.message) console.log(`     ${result.message}`);
  }

  // Summary
  const updated = results.filter(r => r.status === 'UPDATED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const noDelta = results.filter(r => r.status === 'NO_DELTA').length;

  const summary = [
    '=== Wahapedia ETL Summary ===',
    `Updated: ${updated} | No Delta: ${noDelta} | Errors: ${errors}`,
    `Ruleset: ${generateRulesetVersionId()}`,
    `Completed: ${new Date().toISOString()}`,
  ].join('\n');

  console.log(`\n${summary}`);

  if (updated > 0 || errors > 0) {
    await sendAlert(summary);
  }
}
