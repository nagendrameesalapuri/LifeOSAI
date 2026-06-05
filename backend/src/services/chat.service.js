const prisma = require('../lib/prisma');

// How many messages to load as Claude conversation context (keeps token usage bounded)
const HISTORY_CONTEXT_LIMIT = 40;
// How many messages to return to the frontend (for display)
const HISTORY_DISPLAY_LIMIT = 100;

async function saveMessage(userId, role, content) {
  if (!content?.trim()) return null;
  return prisma.chatMessage.create({ data: { userId, role, content } });
}

// Returns messages in chronological order (oldest first) for display
async function getHistory(userId) {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_DISPLAY_LIMIT,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return messages.reverse();
}

// Returns last N messages formatted for Claude's messages array.
// Sanitizes to ensure alternating roles (Claude requires this) and starts with 'user'.
async function getHistoryForClaude(userId) {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_CONTEXT_LIMIT,
    select: { role: true, content: true },
  });
  const chronological = messages.reverse().map(m => ({ role: m.role, content: m.content }));
  return sanitizeForClaude(chronological);
}

// Removes consecutive same-role messages (keeps the latest of each streak)
// and drops any leading assistant message so the array always starts with 'user'.
function sanitizeForClaude(messages) {
  const deduped = [];
  for (const msg of messages) {
    if (deduped.length > 0 && deduped[deduped.length - 1].role === msg.role) {
      deduped[deduped.length - 1] = msg; // replace with more recent same-role msg
    } else {
      deduped.push(msg);
    }
  }
  // Claude requires first message to be 'user'
  while (deduped.length > 0 && deduped[0].role !== 'user') deduped.shift();
  return deduped;
}

async function deleteMessage(id) {
  return prisma.chatMessage.delete({ where: { id } }).catch((e) => {
    console.error('Failed to delete orphaned chat message:', e.message);
    return null;
  });
}

async function clearHistory(userId) {
  return prisma.chatMessage.deleteMany({ where: { userId } });
}

module.exports = { saveMessage, getHistory, getHistoryForClaude, clearHistory, deleteMessage };
