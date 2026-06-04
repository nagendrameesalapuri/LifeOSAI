// Admin-only routes: prompt template management.
// Protected by X-Admin-Secret header matching ADMIN_SECRET env var.
const router = require('express').Router();
const promptService = require('../services/prompt.service');

function adminOnly(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/prompts', adminOnly, async (req, res) => {
  try { res.json(await promptService.list()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/prompts/:key', adminOnly, async (req, res) => {
  try {
    const all = await promptService.list();
    const found = all.find(p => p.key === req.params.key);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json(found);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/prompts/:key', adminOnly, async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });
  try { await promptService.upsert(req.params.key, body); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/prompts/:key', adminOnly, async (req, res) => {
  try { await promptService.remove(req.params.key); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
