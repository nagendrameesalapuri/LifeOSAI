const router = require('express').Router();
const sleep = require('../services/sleep');
const { cacheMiddleware, invalidateUserCache } = require('../middleware/cache');

const FIVE_MIN = 5 * 60 * 1000;

router.post('/log', async (req, res) => {
  try {
    invalidateUserCache(req.user.id);
    res.json(await sleep.logSleep(req.user.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await sleep.getSleepHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/score',   cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await sleep.getSleepScore(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
