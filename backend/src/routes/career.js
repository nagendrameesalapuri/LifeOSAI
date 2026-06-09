const router = require('express').Router();
const career = require('../services/career');
const { cacheMiddleware, invalidateUserCache } = require('../middleware/cache');

const FIVE_MIN = 5 * 60 * 1000;

router.post('/study', async (req, res) => {
  try {
    invalidateUserCache(req.user.id);
    res.json(await career.logStudy(req.user.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await career.getStudyHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/roadmap', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await career.getRoadmap(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', async (req, res) => {
  try { res.json({ response: await career.careerChat(req.user.id, req.body.message) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await career.getCareerStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
