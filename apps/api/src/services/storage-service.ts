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

// Accept both the S3_* names documented in .env.example and the AWS_*
// names used by docker-compose.yml, so either configuration works.
const env = (name: string): string | undefined => process.env[name] || undefined;

const S3_ENDPOINT = env('S3_ENDPOINT') ?? env('AWS_ENDPOINT');
const S3_REGION = env('S3_REGION') ?? env('AWS_REGION') ?? 'auto';
const S3_ACCESS_KEY_ID = env('S3_ACCESS_KEY_ID') ?? env('AWS_ACCESS_KEY_ID') ?? '';
const S3_SECRET_ACCESS_KEY = env('S3_SECRET_ACCESS_KEY') ?? env('AWS_SECRET_ACCESS_KEY') ?? '';
const BUCKET = env('S3_BUCKET') ?? env('S3_BUCKET_NAME') ?? 'forceorg-media';
const CDN_BASE = env('CDN_BASE_URL') ?? env('PUBLIC_CDN_BASE_URL') ?? '';

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT || 'https://s3.amazonaws.com',
  // MinIO and other self-hosted S3 stores use path-style addressing.
  forcePathStyle: Boolean(S3_ENDPOINT),
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
});

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

  // Custom CDN endpoint wins; otherwise derive a URL from the configured
  // endpoint (correct for MinIO/path-style stores) and finally fall back to
  // the AWS-style virtual-hosted URL.
  let url: string;
  if (CDN_BASE) {
    url = `${CDN_BASE.replace(/\/+$/, '')}/${key}`;
  } else if (S3_ENDPOINT) {
    url = `${S3_ENDPOINT.replace(/\/+$/, '')}/${BUCKET}/${key}`;
  } else {
    url = `https://${BUCKET}.s3.amazonaws.com/${key}`;
  }

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
