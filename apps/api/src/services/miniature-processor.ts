// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Sharp Image Processing Pipeline (§9.1)
// SIMD-accelerated miniature photo processing for cards and thumbnails
// ─────────────────────────────────────────────────────────────────────────────

import sharp from 'sharp';

export interface ProcessedMiniaturePayload {
  cardImage: { buffer: Buffer; width: number; height: number; sizeBytes: number };
  thumbnail: { buffer: Buffer; width: number; height: number; sizeBytes: number };
}

/**
 * Processes a raw miniature upload into two optimized WebP variants:
 * - Card image: 400×400 max (fit inside, no enlargement)
 * - Thumbnail: 120×120 (entropy-based crop for best coverage)
 *
 * Both outputs use WebP with smart subsampling for optimal quality/size.
 */
export async function processMiniatureUpload(inputBuffer: Buffer): Promise<ProcessedMiniaturePayload> {
  const pipeline = sharp(inputBuffer, { failOn: 'truncated' }).rotate();

  const [cardImageResult, thumbnailResult] = await Promise.all([
    pipeline
      .clone()
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4, smartSubsample: true })
      .toBuffer({ resolveWithObject: true }),
    pipeline
      .clone()
      .resize(120, 120, { fit: 'cover', position: sharp.strategy.entropy })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true }),
  ]);

  return {
    cardImage: {
      buffer: cardImageResult.data,
      width: cardImageResult.info.width,
      height: cardImageResult.info.height,
      sizeBytes: cardImageResult.info.size,
    },
    thumbnail: {
      buffer: thumbnailResult.data,
      width: thumbnailResult.info.width,
      height: thumbnailResult.info.height,
      sizeBytes: thumbnailResult.info.size,
    },
  };
}
