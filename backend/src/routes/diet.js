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

// Parse meal from base64 photo using Claude Vision
router.post('/parse-photo', async (req, res) => {
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
    res.json(await diet.parseMealFromPhoto(imageBase64, mediaType));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get frequent meals for quick-tap suggestions
router.get('/frequent-meals', async (req, res) => {
  try { res.json(await diet.getFrequentMeals(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Barcode lookup via Open Food Facts (free, no API key needed)
router.get('/barcode/:code', async (req, res) => {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(req.params.code)}.json`);
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.status(404).json({ error: 'Product not found in Open Food Facts' });
    const { nutriments = {}, product_name, quantity } = data.product;
    res.json({
      name: product_name || 'Unknown Product',
      quantity: quantity || '100g',
      calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
      protein: parseFloat((nutriments['proteins_100g'] || nutriments['proteins'] || 0).toFixed(1)),
      carbs: parseFloat((nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0).toFixed(1)),
      fat: parseFloat((nutriments['fat_100g'] || nutriments['fat'] || 0).toFixed(1)),
      fiber: parseFloat((nutriments['fiber_100g'] || nutriments['fiber'] || 0).toFixed(1)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
