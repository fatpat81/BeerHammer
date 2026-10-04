// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Datasheet & Rules Data Routes (public read)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { PrismaClient } from '@forceorg/db-client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/datasheets?factionId=&role=
 * Returns paginated datasheets with optional filters.
 */
router.get('/datasheets', async (req, res) => {
  try {
    const { factionId, role, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (factionId) where.factionId = factionId;
    if (role) where.battlefieldRole = role;

    const [datasheets, total] = await Promise.all([
      prisma.datasheet.findMany({
        where,
        include: {
          weapons: { include: { weapon: true } },
          abilities: true,
          wargearRules: true,
          leaderFor: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { name: 'asc' },
      }),
      prisma.datasheet.count({ where }),
    ]);

    res.json({
      success: true,
      data: datasheets,
      meta: {
        page: parseInt(page as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
        totalCount: total,
      },
    });
  } catch (err) {
    console.error('[Datasheets]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch datasheets.' } });
  }
});

/**
 * GET /api/datasheets/:id
 * Returns a single datasheet with full relations.
 */
router.get('/datasheets/:id', async (req, res) => {
  try {
    const datasheet = await prisma.datasheet.findUnique({
      where: { id: req.params.id },
      include: {
        weapons: { include: { weapon: true } },
        abilities: true,
        wargearRules: true,
        leaderFor: true,
        bodyguardsFor: true,
      },
    });

    if (!datasheet) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Datasheet not found.' } });
      return;
    }

    res.json({ success: true, data: datasheet });
  } catch (err) {
    console.error('[Datasheet]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch datasheet.' } });
  }
});

/**
 * GET /api/stratagems?phase=&category=&detachmentId=
 * Returns filtered stratagems.
 */
router.get('/stratagems', async (req, res) => {
  try {
    const { phase, category, detachmentId } = req.query;
    const where: any = {};
    if (phase) where.phase = phase;
    if (category) where.category = category;
    if (detachmentId) where.detachmentId = detachmentId;

    const stratagems = await prisma.stratagem.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ success: true, data: stratagems });
  } catch (err) {
    console.error('[Stratagems]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch stratagems.' } });
  }
});

/**
 * GET /api/weapons
 * Returns the full weapons registry.
 */
router.get('/weapons', async (_req, res) => {
  try {
    const weapons = await prisma.weapon.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: weapons });
  } catch (err) {
    console.error('[Weapons]', err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch weapons.' } });
  }
});

export { router as datasheetRoutes };
