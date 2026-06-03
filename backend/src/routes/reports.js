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

module.exports = router;
