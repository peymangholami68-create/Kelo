import { Router } from 'express';

const router = Router();

function notReady(_req, res) {
  return res.status(501).json({
    error: 'not_implemented',
    message: 'این endpoint در مرحله بعدی اتصال Authentication و PostgreSQL فعال می‌شود.'
  });
}

router.post('/requests', notReady);
router.post('/request-recipients/:id/accept', notReady);

export default router;
