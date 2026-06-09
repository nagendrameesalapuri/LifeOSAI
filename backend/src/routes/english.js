const router = require('express').Router();
const english = require('../services/english');
const { invalidateUserCache } = require('../middleware/cache');

router.post('/correct', async (req, res) => {
  try { res.json(await english.correctText(req.user.id, req.body.text)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/lesson', async (req, res) => {
  try { res.json(await english.getLesson(req.user.id, req.query.topic)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/lessons/history', async (req, res) => {
  try { res.json(await english.getLessonHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/lessons/complete', async (req, res) => {
  try { invalidateUserCache(req.user.id); res.json(await english.completeLesson(req.user.id, req.body.dayNumber)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/speaking', async (req, res) => {
  try { res.json(await english.practiceSpeaking(req.body.situation)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', async (req, res) => {
  try { res.json(await english.getEnglishHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try { res.json(await english.getEnglishStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/error-patterns', async (req, res) => {
  try { res.json(await english.getErrorPatterns(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vocabulary', async (req, res) => {
  try { res.json(await english.getAllVocabularyCards(req.user.id, req.query.language || 'english')); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vocabulary/due', async (req, res) => {
  try { res.json(await english.getDueVocabularyCards(req.user.id, req.query.language || 'english')); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vocabulary/stats', async (req, res) => {
  try { res.json(await english.getVocabularyStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vocabulary', async (req, res) => {
  try { res.json(await english.addVocabularyCard(req.user.id, req.body, req.body.language || 'english')); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vocabulary/:cardId/review', async (req, res) => {
  const quality = parseInt(req.body?.quality ?? req.query?.quality ?? '0', 10);
  if (isNaN(quality) || quality < 0 || quality > 5) return res.status(400).json({ error: 'quality must be 0–5' });
  try { res.json(await english.reviewVocabularyCard(req.user.id, req.params.cardId, quality)); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
