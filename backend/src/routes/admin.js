// Admin-only routes: prompt template management + profile seeding.
// Protected by X-Admin-Secret header matching ADMIN_SECRET env var.
const router = require('express').Router();
const promptService = require('../services/prompt.service');
const prisma = require('../lib/prisma');

function adminOnly(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/prompts', adminOnly, async (req, res) => {
  try { res.json(await promptService.list()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/prompts/:key', adminOnly, async (req, res) => {
  try {
    const all = await promptService.list();
    const found = all.find(p => p.key === req.params.key);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json(found);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/prompts/:key', adminOnly, async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });
  try { await promptService.upsert(req.params.key, body); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/prompts/:key', adminOnly, async (req, res) => {
  try { await promptService.remove(req.params.key); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// One-time profile seed for the primary user
router.post('/seed-profile', adminOnly, async (req, res) => {
  try {
    const EMAIL = 'nagendrameesala83@gmail.com';
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) return res.status(404).json({ error: `User ${EMAIL} not found — log in once first` });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        weightKg: 62, targetWeightKg: 70, heightCm: 170, age: 27,
        primaryGoal: 'lean_bulk', activityLevel: 'moderate',
        gymAccess: 'commercial', gymDaysPerWeek: 4, fitnessLevel: 'intermediate',
        profession: 'QA Automation Engineer',
        careerGoal: 'custom',
        careerGoalCustom: 'Cloud, DevOps & AI Engineering — Linux, Docker, Kubernetes, AWS, Terraform, Jenkins, Python, LangChain, AI Agents, MCP Servers',
        nativeLanguage: 'telugu',
        languageGoals: ['english', 'kannada'],
        motivationNote: 'QA Automation Engineer (4.1yr) transitioning to Cloud/DevOps/AI. Goal: 62→70kg lean muscle. Improving English fluency (Telugu native) and learning Kannada for Bangalore workplace. Building long-term consistency and discipline.',
        onboardingComplete: true,
      },
    });

    // Seed AI memory
    const memTypes = ['USER_PROFILE', 'CAREER', 'LEARNING'];
    await prisma.aIMemory.deleteMany({ where: { userId: user.id, memoryType: { in: memTypes } } });
    await prisma.aIMemory.createMany({
      data: [
        {
          userId: user.id, memoryType: 'USER_PROFILE',
          content: { name: 'Nagendra', age: 27, location: 'Bangalore', nativeLanguage: 'Telugu', currentWeight: '62kg', targetWeight: '70kg', primaryGoal: 'Lean bulk', communicationChallenges: ['confidence', 'sentence formation', 'grammar', 'word recall', 'fluency'] },
          summary: 'Nagendra, 27, Bangalore. QA→DevOps/AI. Telugu native. Goal: 62→70kg lean bulk. Improving English, learning Kannada.',
        },
        {
          userId: user.id, memoryType: 'CAREER',
          content: { currentRole: 'QA Automation Engineer', yearsExperience: 4.1, currentSkills: ['Selenium', 'Playwright', 'Java', 'TypeScript', 'API Testing', 'CI/CD'], targetRole: 'Cloud, DevOps & AI Engineer', learningPath: ['Linux', 'Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Python', 'LangChain', 'AI Agents', 'MCP Servers'] },
          summary: 'QA → DevOps/AI transition. 4.1yr experience. Target: Linux, Docker, K8s, AWS, Terraform, Python, LangChain, AI Agents.',
        },
        {
          userId: user.id, memoryType: 'LEARNING',
          content: { english: { nativeLanguage: 'Telugu', challenges: ['confidence', 'speed', 'grammar', 'word recall'], goal: 'Professional English fluency' }, kannada: { level: 'beginner', goal: 'Conversational for Bangalore daily life and workplace' } },
          summary: 'Telugu native. English: building professional confidence. Kannada: beginner learning for Bangalore.',
        },
      ],
    });

    res.json({ ok: true, userId: user.id, message: 'Profile and AI memory seeded successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
