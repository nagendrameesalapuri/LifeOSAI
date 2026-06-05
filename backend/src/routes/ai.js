const router = require('express').Router();
const ai = require('../services/ai');
const anthropic = require('../lib/anthropic');
const memory = require('../services/memory');
const chat = require('../services/chat.service');
const promptService = require('../services/prompt.service');

// GET chat history (for page load)
router.get('/chat/history', async (req, res) => {
  try { res.json(await chat.getHistory(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE chat history
router.delete('/chat/history', async (req, res) => {
  try { await chat.clearHistory(req.user.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Streaming chat — loads history from DB, saves every message, full user data context
router.post('/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { message } = req.body;
    const userId = req.user.id;

    // Save user message to DB first
    await chat.saveMessage(userId, 'user', message);

    // Load full history from DB + rich user context in parallel
    const [dbHistory, context] = await Promise.all([
      chat.getHistoryForClaude(userId),
      memory.getContextualMemory(userId),
    ]);

    // dbHistory already includes the message we just saved
    const messages = dbHistory.length > 0 ? dbHistory : [{ role: 'user', content: message }];

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: await promptService.get('MAIN_COACH', context),
      messages,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        fullResponse += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // Save assistant response to DB after stream completes
    await chat.saveMessage(userId, 'assistant', fullResponse);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// Non-streaming chat (Telegram / fallback) — also saves to DB
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    await chat.saveMessage(userId, 'user', message);
    const [dbHistory, context] = await Promise.all([
      chat.getHistoryForClaude(userId),
      memory.getContextualMemory(userId),
    ]);

    const messages = dbHistory.length > 0 ? dbHistory : [{ role: 'user', content: message }];
    const response = await ai.chatWithMessages(userId, context, messages);
    await chat.saveMessage(userId, 'assistant', response);
    res.json({ response });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/daily-plan', async (req, res) => {
  try { res.json({ plan: await ai.generateDailyPlan(req.user.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insights', async (req, res) => {
  try { res.json({ insights: await ai.generateAiInsights(req.user.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/career', async (req, res) => {
  try { res.json({ response: await ai.careerCoach(req.user.id, req.body.message) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Streaming career coach
router.post('/career/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { message, history = [] } = req.body;
    const [context, userProfile] = await Promise.all([
      memory.getContextualMemory(req.user.id),
      require('../lib/prisma').user.findUnique({ where: { id: req.user.id }, select: { profession: true, careerGoal: true, careerGoalCustom: true } }).catch(() => null),
    ]);
    const careerProfile = { currentRole: userProfile?.profession, careerGoal: userProfile?.careerGoal, careerGoalCustom: userProfile?.careerGoalCustom };
    const messages = [...history.slice(-20).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }];

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: await promptService.get('CAREER_COACH', context, careerProfile),
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
