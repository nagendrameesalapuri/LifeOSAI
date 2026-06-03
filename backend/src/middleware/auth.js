const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
      return res.status(500).json({ message: 'AUTH_SECRET not configured' });
    }

    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // NextAuth token contains: sub (Google user ID), email, name
    const googleSub = payload.sub;
    const email = payload.email;
    const name = payload.name || email?.split('@')[0] || 'User';

    if (!email && !googleSub) {
      return res.status(401).json({ message: 'Token missing user identifier' });
    }

    // clerkId field is reused to store Google OAuth sub (no migration needed)
    let user = null;

    if (googleSub) {
      user = await prisma.user.findUnique({ where: { clerkId: googleSub } }).catch(() => null);
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
    }

    if (user) {
      // Build update payload: backfill googleSub + fix stale/generated names
      const updates = {};
      if (googleSub && user.clerkId !== googleSub) updates.clerkId = googleSub;
      // Name looks like a Clerk ID (starts with "user_") or is the email prefix — replace with real Google name
      const nameIsStale = !user.name || user.name.startsWith('user_') || user.name === user.email?.split('@')[0];
      if (nameIsStale && payload.name) updates.name = payload.name;
      if (Object.keys(updates).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates }).catch(() => user);
      }
    }

    // Auto-create user on first Google sign-in
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: googleSub || `google_${Date.now()}`,
          email: email || `${googleSub}@google.user`,
          name,
          weightKg: 62,
          targetWeightKg: 70,
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ message: 'Authentication failed' });
  }
}

module.exports = authMiddleware;
