// Simple in-memory response cache middleware
// Keyed by userId + path so each user gets isolated cache entries

const store = new Map(); // key → { data, expiresAt }

function cacheMiddleware(ttlMs = 5 * 60 * 1000) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!req.user?.id) return next(); // never cache unauthenticated requests

    const key = `${req.user.id}:${req.path}${Object.keys(req.query).length ? ':' + JSON.stringify(req.query) : ''}`;
    const hit = store.get(key);

    if (hit && hit.expiresAt > Date.now()) {
      return res.json(hit.data);
    }

    // Intercept res.json to cache the response
    const origJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        store.set(key, { data, expiresAt: Date.now() + ttlMs });
      }
      return origJson(data);
    };

    next();
  };
}

function invalidateCache(userId, pathPrefix) {
  for (const key of store.keys()) {
    if (key.startsWith(`${userId}:${pathPrefix}`)) {
      store.delete(key);
    }
  }
}

function invalidateUserCache(userId) {
  for (const key of store.keys()) {
    if (key.startsWith(`${userId}:`)) store.delete(key);
  }
}

module.exports = { cacheMiddleware, invalidateCache, invalidateUserCache };
