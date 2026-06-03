const router = require('express').Router();
const analytics = require('../services/analytics');
const { cacheMiddleware } = require('../middleware/cache');

const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN  = 10 * 60 * 1000;

router.get('/dashboard',          cacheMiddleware(FIVE_MIN),  async (req, res) => {
  try { res.json(await analytics.getDashboard(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/trends',             cacheMiddleware(TEN_MIN),   async (req, res) => {
  try { res.json(await analytics.getTrends(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insights',           cacheMiddleware(TEN_MIN),   async (req, res) => {
  try { res.json({ insights: await analytics.getInsights(req.user.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/score-breakdown',    cacheMiddleware(FIVE_MIN),  async (req, res) => {
  try { res.json(await analytics.getScoreBreakdown(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/proactive-insights', cacheMiddleware(TEN_MIN),   async (req, res) => {
  try { res.json(await analytics.getProactiveInsights(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/correlations',       cacheMiddleware(TEN_MIN),   async (req, res) => {
  try { res.json(await analytics.getCorrelationInsights(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
