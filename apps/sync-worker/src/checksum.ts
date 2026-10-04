// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Checksum & ETag Utility
// Detects data deltas by comparing content hashes against stored metadata
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';

/**
 * Computes the SHA-256 content hash of a string payload.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compares the incoming hash against the stored hash.
 * Returns true if a delta is detected (hashes differ).
 */
export function hasDelta(incomingHash: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return true; // No previous record = always a delta
  return incomingHash !== storedHash;
}

/**
 * Extracts ETag and Last-Modified from HTTP response headers.
 */
export function extractCacheHeaders(headers: Headers): {
  etag: string | null;
  lastModified: string | null;
} {
  return {
    etag: headers.get('etag'),
    lastModified: headers.get('last-modified'),
  };
}
