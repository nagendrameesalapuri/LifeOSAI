const router = require('express').Router();
const ai = require('../services/ai');
const anthropic = require('../lib/anthropic');
const memory = require('../services/memory');
const { SYSTEM_PROMPTS } = require('../data/prompts');
const promptService = require('../services/prompt.service');

// Streaming chat with conversation history
router.post('/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { message, history = [] } = req.body;
    const context = await memory.getContextualMemory(req.user.id);

    // Build messages array with conversation history (last 10 exchanges)
    const trimmedHistory = history.slice(-20); // max 20 messages (10 exchanges)
    const messages = [
      ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: await promptService.get('MAIN_COACH', context),
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

// Non-streaming chat (fallback + Telegram)
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const response = await ai.chatWithHistory(req.user.id, message, history);
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
