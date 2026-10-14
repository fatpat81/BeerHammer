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

// ── Root Landing / Guide ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>ForceOrg-40k API</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box;">
          <div style="background: #111827; border: 1px solid #1f2937; padding: 2.5rem; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚔️</div>
            <h1 style="color: #60a5fa; margin: 0 0 0.75rem 0; font-size: 1.5rem;">ForceOrg-40k Backend API</h1>
            <p style="color: #9ca3af; margin: 0 0 1.5rem 0; font-size: 0.95rem; line-height: 1.5;">
              You are connected to the backend REST API on <strong>Port 4000</strong>.
            </p>
            <p style="color: #d1d5db; margin: 0 0 1.75rem 0; font-size: 0.95rem;">
              To use the interactive <strong>Army Builder & Tabletop Web App</strong>, open Port 3000:
            </p>
            <a href="http://localhost:3000" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 1rem;">Open Web App (Port 3000) &rarr;</a>
          </div>
        </body>
      </html>
    `);
  }
  res.json({
    service: 'ForceOrg-40k API',
    status: 'operational',
    webAppUrl: 'http://localhost:3000',
    endpoints: {
      health: '/api/health',
      datasheets: '/api/datasheets',
      rosters: '/api/rosters',
    },
  });
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
