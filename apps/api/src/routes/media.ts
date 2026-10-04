// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Miniature Media Upload/Delete Routes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@forceorg/db-client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { processMiniatureUpload } from '../services/miniature-processor';
import { uploadImage, deleteImage, buildStorageKeyPrefix } from '../services/storage-service';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * POST /api/rosters/:rosterId/units/:unitInstanceId/media
 * Uploads a custom miniature photo, processes it through Sharp,
 * and stores both card and thumbnail variants in S3/R2.
 */
router.post(
  ['/rosters/:rosterId/units/:unitInstanceId/media', '/media/upload'],
  requireAuth,
  upload.any(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const rosterId = req.params.rosterId || (req.body?.rosterId as string);
      const unitInstanceId = req.params.unitInstanceId || (req.body?.unitInstanceId as string);
      if (!rosterId || !unitInstanceId) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'rosterId and unitInstanceId are required.' } });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      const file = req.file || (files && files.length > 0 ? files[0] : null);

      if (!file) {
        res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No image file provided.' } });
        return;
      }

      // Verify roster ownership
      const roster = await prisma.userArmy.findFirst({
        where: { id: rosterId, userId: req.userId! },
      });

      if (!roster) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Roster not found.' } });
        return;
      }

      // Process image through Sharp pipeline
      const processed = await processMiniatureUpload(file.buffer);

      // Build storage keys
      const prefix = buildStorageKeyPrefix(req.userId!, rosterId, unitInstanceId);
      const cardKey = `${prefix}/card.webp`;
      const thumbKey = `${prefix}/thumb.webp`;

      // Upload to S3/R2
      const [cardUpload, thumbUpload] = await Promise.all([
        uploadImage(cardKey, processed.cardImage.buffer),
        uploadImage(thumbKey, processed.thumbnail.buffer),
      ]);

      // Upsert media record
      const media = await prisma.userUnitMedia.upsert({
        where: {
          rosterId_unitInstanceId: {
            rosterId,
            unitInstanceId,
          },
        },
        update: {
          imageUrl: cardUpload.url,
          thumbnailUrl: thumbUpload.url,
          storageKeyPrefix: prefix,
        },
        create: {
          userId: req.userId!,
          rosterId,
          unitInstanceId,
          imageUrl: cardUpload.url,
          thumbnailUrl: thumbUpload.url,
          storageKeyPrefix: prefix,
        },
      });

      res.json({
        success: true,
        data: {
          media,
          processing: {
            cardImage: { width: processed.cardImage.width, height: processed.cardImage.height, sizeBytes: processed.cardImage.sizeBytes },
            thumbnail: { width: processed.thumbnail.width, height: processed.thumbnail.height, sizeBytes: processed.thumbnail.sizeBytes },
          },
        },
      });
    } catch (err) {
      console.error('[Media Upload]', err);
      res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: 'Failed to process upload.' } });
    }
  }
);

/**
 * DELETE /api/rosters/:rosterId/units/:unitInstanceId/media
 * Removes custom photo and reverts to canonical default.
 */
router.delete(
  ['/rosters/:rosterId/units/:unitInstanceId/media', '/media/:id'],
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rosterId, unitInstanceId, id } = req.params;

      let media = null;
      if (id) {
        media = await prisma.userUnitMedia.findFirst({
          where: { id, userId: req.userId! },
        });
      } else if (rosterId && unitInstanceId) {
        media = await prisma.userUnitMedia.findFirst({
          where: {
            rosterId,
            unitInstanceId,
            userId: req.userId!,
          },
        });
      } else {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Identifier parameters are required.' } });
        return;
      }

      if (!media) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });
        return;
      }

      // Delete from S3/R2
      await Promise.all([
        deleteImage(`${media.storageKeyPrefix}/card.webp`),
        deleteImage(`${media.storageKeyPrefix}/thumb.webp`),
      ]);

      // Delete DB record
      await prisma.userUnitMedia.delete({ where: { id: media.id } });

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      console.error('[Media Delete]', err);
      res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete media.' } });
    }
  }
);

export { router as mediaRoutes };
