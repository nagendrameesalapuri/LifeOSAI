const router = require('express').Router();
const telegram = require('../services/telegram');

// Telegram calls this with every update (message, command, etc.)
router.post('/webhook', (req, res) => {
  res.json({ ok: true }); // Respond immediately so Telegram doesn't retry
  telegram.processWebhook(req.body);
});

// Public status endpoint — check webhook registration and bot health
// Visit: https://your-backend.up.railway.app/api/telegram/status
router.get('/status', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' });

    const [meRes, webhookRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getMe`),
      fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
    ]);
    const me = await meRes.json();
    const webhook = await webhookRes.json();

    res.json({
      bot: me.ok ? { username: me.result.username, id: me.result.id } : { error: me.description },
      webhook: webhook.ok ? {
        url: webhook.result.url || '(not set — polling mode)',
        pendingUpdateCount: webhook.result.pending_update_count,
        lastError: webhook.result.last_error_message || null,
        lastErrorDate: webhook.result.last_error_date ? new Date(webhook.result.last_error_date * 1000) : null,
      } : { error: webhook.description },
      backendUrl: process.env.BACKEND_URL || '(not set)',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Force re-register webhook (call if Telegram stopped delivering)
router.post('/setup-webhook', async (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await telegram.registerWebhook();
    res.json({ ok: true, message: 'Webhook re-registered' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
