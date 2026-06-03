const router = require('express').Router();
const ai = require('../services/ai');

router.post('/chat', async (req, res) => {
  try { res.json({ response: await ai.chat(req.user.id, req.body.message) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-plan', async (req, res) => {
  try { res.json({ plan: await ai.generateDailyPlan(req.user.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insights', async (req, res) => {
  try { res.json({ insights: await ai.generateAiInsights(req.user.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/career', async (req, res) => {
  try { res.json({ response: await ai.careerCoach(req.user.id, req.body.message) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
