const router = require('express').Router();
const telegram = require('../services/telegram');

router.post('/webhook', (req, res) => {
  telegram.processWebhook(req.body);
  res.json({ ok: true });
});

module.exports = router;
