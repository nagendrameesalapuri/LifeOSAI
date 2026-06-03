const router = require('express').Router();
const fitness = require('../services/fitness');

router.post('/weight', async (req, res) => {
  try { res.json(await fitness.logWeight(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/weight/history', async (req, res) => {
  try { res.json(await fitness.getWeightHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workout', async (req, res) => {
  try { res.json(await fitness.logWorkout(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/workout/history', async (req, res) => {
  try { res.json(await fitness.getWorkoutHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/workout/plan', async (req, res) => {
  try { res.json(await fitness.getWorkoutPlan(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/workout/overload', async (req, res) => {
  try { res.json(await fitness.getProgressiveOverload(req.user.id, req.query.exercise)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try { res.json(await fitness.getFitnessStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/program/generate', async (req, res) => {
  try { res.json(await fitness.generateProgram(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/program/active', async (req, res) => {
  try { res.json(await fitness.getActiveProgram(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/program/session/:sessionId/complete', async (req, res) => {
  try { res.json(await fitness.completeSession(req.user.id, req.params.sessionId, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/measurements', async (req, res) => {
  try { res.json(await fitness.logBodyMeasurement(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/measurements', async (req, res) => {
  try { res.json(await fitness.getBodyMeasurements(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
