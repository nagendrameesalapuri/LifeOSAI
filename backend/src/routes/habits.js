const router = require('express').Router();
const habits = require('../services/habits');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

const FIVE_MIN = 5 * 60 * 1000;

router.post('/checkin', async (req, res) => {
  try {
    invalidateCache(req.user.id, '/habits');
    invalidateCache(req.user.id, '/analytics');
    res.json(await habits.checkIn(req.user.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history',          cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await habits.getHabitHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scores',           cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await habits.getHabitScores(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/streaks',          cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await habits.getStreaks(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/morning-checkin', async (req, res) => {
  try { res.json(await habits.saveMorningCheckin(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/morning-checkin',  cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await habits.getMorningCheckin(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
