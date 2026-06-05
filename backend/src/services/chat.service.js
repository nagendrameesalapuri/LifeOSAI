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

// Returns last N messages formatted for Claude's messages array
async function getHistoryForClaude(userId) {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_CONTEXT_LIMIT,
    select: { role: true, content: true },
  });
  return messages.reverse().map(m => ({ role: m.role, content: m.content }));
}

async function clearHistory(userId) {
  return prisma.chatMessage.deleteMany({ where: { userId } });
}

module.exports = { saveMessage, getHistory, getHistoryForClaude, clearHistory };
