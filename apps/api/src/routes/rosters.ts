// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Roster CRUD Routes (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { PrismaClient } from '@forceorg/db-client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/rosters
 * Returns all rosters for the authenticated user.
 */
router.get('/rosters', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const armies = await prisma.userArmy.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: armies });
  } catch (err) {
    console.error('[Rosters GET]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch rosters.' } });
  }
});

/**
 * GET /api/rosters/:id
 * Returns a single roster with unit media.
 */
router.get('/rosters/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const army = await prisma.userArmy.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { unitMedia: true },
    });

    if (!army) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Roster not found.' } });
      return;
    }

    res.json({ success: true, data: army });
  } catch (err) {
    console.error('[Roster GET]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch roster.' } });
  }
});

/**
 * POST /api/rosters
 * Creates a new army roster.
 */
router.post('/rosters', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      factionId,
      detachmentPrimary,
      detachmentSecondary,
      pointsLimit = 2000,
      detachmentPointsLimit = 3,
      factionThemeOverride,
      rosterPayload,
    } = req.body;

    const army = await prisma.userArmy.create({
      data: {
        userId: req.userId!,
        name,
        factionId,
        rulesetVersionId: '11.1.0-2026-Q3',
        detachmentPrimary,
        detachmentSecondary,
        pointsLimit,
        detachmentPointsLimit,
        factionThemeOverride,
        rosterPayload: rosterPayload || { units: [], totalPoints: 0, detachmentPointsUsed: 0 },
      },
    });

    res.status(201).json({ success: true, data: army });
  } catch (err) {
    console.error('[Roster POST]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to create roster.' } });
  }
});

/**
 * PUT /api/rosters/:id
 * Updates an existing roster's payload and metadata.
 */
router.put('/rosters/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.userArmy.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Roster not found.' } });
      return;
    }

    const army = await prisma.userArmy.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? existing.name,
        detachmentPrimary: req.body.detachmentPrimary ?? existing.detachmentPrimary,
        detachmentSecondary: req.body.detachmentSecondary,
        pointsLimit: req.body.pointsLimit ?? existing.pointsLimit,
        factionThemeOverride: req.body.factionThemeOverride,
        rosterPayload: req.body.rosterPayload ?? existing.rosterPayload,
      },
    });

    res.json({ success: true, data: army });
  } catch (err) {
    console.error('[Roster PUT]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to update roster.' } });
  }
});

/**
 * DELETE /api/rosters/:id
 * Deletes a roster and all associated media (cascading).
 */
router.delete('/rosters/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.userArmy.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Roster not found.' } });
      return;
    }

    await prisma.userArmy.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[Roster DELETE]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to delete roster.' } });
  }
});

export { router as rosterRoutes };
