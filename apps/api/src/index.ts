// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Express API Server Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { rosterRoutes } from './routes/rosters';
import { mediaRoutes } from './routes/media';
import { auditRoutes } from './routes/audit';
import { datasheetRoutes } from './routes/datasheets';
import { changelogRoutes } from './routes/changelog';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Global Middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ── Rate Limiting Middleware (§4.3) ──────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // max 300 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again in a few minutes.',
    },
  },
});

app.use('/api', apiLimiter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Route Mounts ──────────────────────────────────────────────────────────────
app.use('/api', datasheetRoutes);
app.use('/api', rosterRoutes);
app.use('/api', mediaRoutes);
app.use('/api', auditRoutes);
app.use('/api', changelogRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message, err.stack);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[ForceOrg API] Running on port ${PORT}`);
});

export default app;
