const router = require('express').Router();

// Placeholder — Clerk webhooks removed, auth is handled via Google OAuth + NextAuth
router.post('/webhook', (req, res) => {
  res.json({ received: true });
});

module.exports = router;
