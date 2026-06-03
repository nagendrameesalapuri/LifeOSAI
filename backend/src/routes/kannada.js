const router = require('express').Router();
const kannada = require('../services/kannada');

router.get('/lesson', async (req, res) => {
  try { res.json(await kannada.getDailyLesson(req.user.id, req.query.day ? parseInt(req.query.day) : undefined)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/lesson/:day', async (req, res) => {
  try { res.json(await kannada.getLessonByDay(req.user.id, parseInt(req.params.day))); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/curriculum', async (req, res) => {
  res.json(kannada.getCurriculum());
});

router.get('/script', async (req, res) => {
  res.json(kannada.getScriptLesson());
});

router.get('/lessons/history', async (req, res) => {
  try { res.json(await kannada.getLessonHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/lessons/complete', async (req, res) => {
  try { res.json(await kannada.completeLesson(req.user.id, req.body.dayNumber)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/log', async (req, res) => {
  try { res.json(await kannada.logProgress(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/progress', async (req, res) => {
  try { res.json(await kannada.getProgress(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
