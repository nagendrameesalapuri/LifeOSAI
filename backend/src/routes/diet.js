const router = require('express').Router();
const diet = require('../services/diet');

router.post('/log', async (req, res) => {
  try { res.json(await diet.logDiet(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/replace', async (req, res) => {
  try { res.json(await diet.replaceDiet(req.user.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/today', async (req, res) => {
  try { res.json(await diet.getTodayDiet(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', async (req, res) => {
  try { res.json(await diet.getDietHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/plan', async (req, res) => {
  try { res.json(await diet.getDietPlan(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try { res.json(await diet.getDietStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/nutrition', async (req, res) => {
  try { res.json(await diet.getNutrition(req.query.food, req.query.qty)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/parse-meal', async (req, res) => {
  try { res.json(await diet.parseMeal(req.body.description)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/water', async (req, res) => {
  try { res.json(await diet.logWater(req.user.id, req.body.litres)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/water/today', async (req, res) => {
  try { res.json(await diet.getTodayWater(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/shopping-list', async (req, res) => {
  try { res.json(await diet.getShoppingList(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/meal-timing', async (req, res) => {
  try { res.json(await diet.getMealTimingAdvice(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tdee', async (req, res) => {
  try { res.json(await diet.getTDEE(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
