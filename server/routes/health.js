import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const payload = {
    service: 'kelo-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'unknown'
  };

  try {
    await query('select 1 as ok');
    payload.database = 'up';
    return res.status(200).json(payload);
  } catch (error) {
    payload.status = 'degraded';
    payload.database = 'down';
    return res.status(503).json(payload);
  }
});

router.get('/ready', async (_req, res) => {
  try {
    await query('select 1 as ok');
    return res.status(200).json({ ready: true });
  } catch (error) {
    return res.status(503).json({ ready: false });
  }
});

export default router;
