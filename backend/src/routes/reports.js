const router = require('express').Router();
const reports = require('../services/reports');

router.post('/weekly', async (req, res) => {
  try { res.json(await reports.generateWeeklyReport(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
  try { res.json(await reports.getReports(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/latest', async (req, res) => {
  try { res.json(await reports.getLatestReport(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Compare this week vs last week scores. Generate a new plan if stagnant.
router.get('/check-progress', async (req, res) => {
  try { res.json(await reports.checkProgressAndAdapt(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark the current adaptive plan update as seen (dismiss the banner).
router.post('/plan-update/dismiss', async (req, res) => {
  try {
    await reports.dismissPlanUpdate(req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
