require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const authMiddleware = require('./middleware/auth');
const { initCronJobs } = require('./cron/jobs');
const telegramService = require('./services/telegram');

// Per-user rate limiters — keyed by userId for authenticated routes,
// ipKeyGenerator (IPv6-safe) as fallback for unauthenticated requests.
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: { error: 'Too many AI requests. Limit: 30 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAiLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: { error: 'Slow down — max 5 AI requests per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'lifeos-backend' });
});

// DB connectivity check (no auth)
app.get('/api/health/db', async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const users = await prisma.user.count();
    res.json({ db: 'ok', users });
  } catch (e) {
    res.status(503).json({ db: 'error', code: e.code, message: e.message?.slice(0, 200) });
  }
});

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/telegram', require('./routes/telegram'));
// Admin routes — protected by X-Admin-Secret header only (no JWT needed)
app.use('/api/admin', require('./routes/admin'));

// All routes below require authentication
app.use('/api', authMiddleware);
app.use('/api/users', require('./routes/users'));
app.use('/api/fitness', require('./routes/fitness'));
app.use('/api/sleep', require('./routes/sleep'));
app.use('/api/habits', require('./routes/habits'));
app.use('/api/diet', require('./routes/diet'));
app.use('/api/ai', strictAiLimit, aiRateLimit, require('./routes/ai'));
app.use('/api/english', require('./routes/english'));
app.use('/api/kannada', require('./routes/kannada'));
app.use('/api/career', require('./routes/career'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports', require('./routes/reports'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`LIFEOS Backend running on port ${PORT}`);
  await telegramService.init();
  initCronJobs();
});

module.exports = app;
