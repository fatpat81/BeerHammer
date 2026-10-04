// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — S3/R2 Object Storage Service
// Manages uploads and deletions for miniature photos
// ─────────────────────────────────────────────────────────────────────────────

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.S3_BUCKET || 'forceorg-media';
const CDN_BASE = process.env.CDN_BASE_URL || '';

export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

/**
 * Uploads a processed image buffer to S3/R2 storage.
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  contentType: string = 'image/webp'
): Promise<UploadResult> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = CDN_BASE ? `${CDN_BASE}/${key}` : `https://${BUCKET}.s3.amazonaws.com/${key}`;

  return {
    key,
    url,
    sizeBytes: buffer.length,
  };
}

/**
 * Deletes an object from S3/R2 storage.
 */
export async function deleteImage(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Builds the storage key prefix for a user's unit media.
 * Format: users/{userId}/rosters/{rosterId}/units/{unitInstanceId}/
 */
export function buildStorageKeyPrefix(
  userId: string,
  rosterId: string,
  unitInstanceId: string
): string {
  return `users/${userId}/rosters/${rosterId}/units/${unitInstanceId}`;
}
