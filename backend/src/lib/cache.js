// Unified cache: Redis when REDIS_URL is set, in-memory Map otherwise.
// All values are JSON-serialized. TTL is in seconds.
let client = null;

if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    client.on('error', (e) => console.warn('Redis error (falling back to memory):', e.message));
    client.connect().catch(() => { client = null; });
  } catch {
    console.warn('ioredis not available, using in-memory cache');
  }
}

const mem = new Map();

async function get(key) {
  if (client) {
    try {
      const val = await client.get(key);
      return val ? JSON.parse(val) : null;
    } catch {}
  }
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { mem.delete(key); return null; }
  return entry.value;
}

async function set(key, value, ttlSeconds = 86400) {
  if (client) {
    try { await client.set(key, JSON.stringify(value), 'EX', ttlSeconds); return; } catch {}
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function del(key) {
  if (client) { try { await client.del(key); } catch {} }
  mem.delete(key);
}

module.exports = { get, set, del };
