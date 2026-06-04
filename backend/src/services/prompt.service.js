// DB-backed prompt templates with 5-minute in-memory cache.
// Falls back to hardcoded SYSTEM_PROMPTS if no DB entry exists.
// Admin can update prompts via PUT /api/admin/prompts/:key → takes effect within 5 min.
const prisma = require('../lib/prisma');
const { SYSTEM_PROMPTS } = require('../data/prompts');

let dbPrompts = new Map();
let loadedAt = 0;
const TTL = 5 * 60 * 1000;
const RETRY_BACKOFF = 30 * 1000; // on failure, wait 30s before retrying (not per-request)

async function reload() {
  if (Date.now() - loadedAt < TTL) return;
  // Set loadedAt before the attempt so a failing DB doesn't get hammered every request.
  // On success it's refreshed accurately; on failure it backs off by RETRY_BACKOFF.
  loadedAt = Date.now() - TTL + RETRY_BACKOFF;
  try {
    const rows = await prisma.promptTemplate.findMany();
    dbPrompts = new Map(rows.map(r => [r.key, r.body]));
    loadedAt = Date.now(); // success: full TTL
  } catch (e) {
    console.warn('Prompt DB load failed, using defaults:', e.message);
    // loadedAt stays at (now - TTL + RETRY_BACKOFF), so next retry is in 30s
  }
}

// Returns the system prompt string for a given key.
// args[0] is typically context (string) or userProfile (object).
async function get(key, ...args) {
  await reload();
  const body = dbPrompts.get(key);
  if (body) {
    const arg = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0] || {});
    const extra = args[1] ? JSON.stringify(args[1]) : '';
    return body.replace('{{context}}', arg).replace('{{extra}}', extra);
  }
  const fn = SYSTEM_PROMPTS[key];
  return fn ? fn(...args) : '';
}

async function upsert(key, body) {
  await prisma.promptTemplate.upsert({
    where: { key },
    update: { body, version: { increment: 1 } },
    create: { key, body, version: 1 },
  });
  loadedAt = 0;
}

async function remove(key) {
  await prisma.promptTemplate.delete({ where: { key } }).catch(() => {});
  loadedAt = 0;
}

async function list() {
  await reload();
  const allKeys = Object.keys(SYSTEM_PROMPTS).filter(k => typeof SYSTEM_PROMPTS[k] === 'function');
  return allKeys.map(key => ({
    key,
    isCustomized: dbPrompts.has(key),
    body: dbPrompts.get(key) || null,
  }));
}

module.exports = { get, upsert, remove, list };
