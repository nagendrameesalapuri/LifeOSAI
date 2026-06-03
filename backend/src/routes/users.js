const router = require('express').Router();
const users = require('../services/users');
const { cacheMiddleware, invalidateUserCache } = require('../middleware/cache');

const FIVE_MIN = 5 * 60 * 1000;

router.get('/me', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await users.getProfile(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/me', async (req, res) => {
  try {
    invalidateUserCache(req.user.id);
    res.json(await users.updateProfile(req.user.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me/stats', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await users.getStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
