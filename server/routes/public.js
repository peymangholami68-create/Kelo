import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/services', async (_req, res, next) => {
  try {
    const result = await query(
      `select id, slug, name, description, sort_order
         from service_types
        where is_active = true
        order by sort_order asc, name asc`
    );
    return res.json({ services: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/settings/public', async (_req, res, next) => {
  try {
    const result = await query(
      `select key, value_text, value_num
         from app_settings
        where is_public = true
        order by key`
    );
    return res.json({ settings: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;
