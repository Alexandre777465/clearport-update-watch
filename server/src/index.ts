import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { startScheduler } from './cron/scheduler';
import { alertsRouter } from './routes/alerts';
import { productsRouter } from './routes/products';
import { htsCodesRouter } from './routes/htsCodes';
import { sourcesRouter } from './routes/sources';
import { askRouter } from './routes/ask';
import { notificationsRouter } from './routes/notifications';
import { watchlistRouter } from './routes/watchlist';
import { scanRouter } from './routes/scan';
import { requireAuth } from './middleware/auth';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Public ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/public/watchlist', watchlistRouter);
app.use('/api/public/scan', scanRouter);

// ── Protected ───────────────────────────────────────────────────────────────
app.use('/api', requireAuth as any);
app.use('/api/alerts', alertsRouter);
app.use('/api/products', productsRouter);
app.use('/api/hts-codes', htsCodesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/ask', askRouter);
app.use('/api/notifications', notificationsRouter);

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err?.message ?? err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({ error: err?.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[server] ClearPort backend on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
});

if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

export default app;
