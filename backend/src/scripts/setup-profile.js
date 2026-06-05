// One-time profile setup for Nagendra.
// Run via: railway run node src/scripts/setup-profile.js
require('dotenv').config();
const prisma = require('../lib/prisma');

const EMAIL = 'nagendrameesala83@gmail.com';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`User not found: ${EMAIL}`);
    console.error('Make sure you have logged in once via the web app first.');
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.id})`);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Body
      weightKg:       62,
      targetWeightKg: 70,
      heightCm:       170,
      age:            27,

      // Fitness
      primaryGoal:    'lean_bulk',
      activityLevel:  'moderate',
      gymAccess:      'commercial',
      gymDaysPerWeek: 4,
      fitnessLevel:   'intermediate',

      // Career
      profession:        'QA Automation Engineer',
      careerGoal:        'custom',
      careerGoalCustom:  'Cloud, DevOps & AI Engineering — Linux, Docker, Kubernetes, AWS, Terraform, Jenkins, Python, LangChain, AI Agents, MCP Servers',

      // Languages
      nativeLanguage: 'telugu',
      languageGoals:  ['english', 'kannada'],

      // Motivation
      motivationNote: `QA Automation Engineer with 4.10 years experience in Selenium, Playwright, Java, TypeScript, API Testing, CI/CD. Transitioning to Cloud, DevOps & AI Engineering.

Fitness goal: Build lean muscle from 62kg to 70kg. Consistent diet, workout, sleep, and discipline.

English goal: Overcome confidence gap, improve fluency, grammar, and professional communication. Native Telugu speaker, Telugu medium education, living in Bangalore.

Kannada goal: Conversational Kannada for daily life and workplace in Bangalore.

Core focus: Long-term consistency, discipline, productivity, and career transformation.`,

      onboardingComplete: true,
    },
  });

  console.log('✅ Profile updated successfully!');

  // Seed AI memory entries for rich context
  const memoryTypes = ['USER_PROFILE', 'CAREER', 'LEARNING'];
  await prisma.aIMemory.deleteMany({ where: { userId: user.id, memoryType: { in: memoryTypes } } });

  await prisma.aIMemory.createMany({
    data: [
      {
        userId: user.id,
        memoryType: 'USER_PROFILE',
        content: {
          name: 'Nagendra',
          age: 27,
          location: 'Bangalore',
          nativeLanguage: 'Telugu',
          background: 'Telugu medium education. Living in Bangalore for several years.',
          currentWeight: '62kg',
          targetWeight: '70kg',
          primaryGoal: 'Lean bulk — build 8kg of lean muscle',
          fitnessGoals: ['Build muscular physique', 'Improve sleep quality', 'Consistent diet and workout', 'Long-term discipline'],
          communicationChallenges: ['Lack of confidence speaking English', 'Difficulty forming sentences quickly', 'Grammar mistakes during conversations', 'Forgetting words while speaking', 'Limited spoken fluency'],
        },
        summary: 'Nagendra, 27, Bangalore. QA Engineer transitioning to DevOps/AI. Telugu native, improving English fluency and learning Kannada. Goal: 62→70kg lean bulk.',
      },
      {
        userId: user.id,
        memoryType: 'CAREER',
        content: {
          currentRole: 'QA Automation Engineer',
          yearsExperience: 4.1,
          currentSkills: ['Selenium', 'Playwright', 'Java', 'TypeScript', 'API Testing', 'CI/CD basics'],
          targetRole: 'Cloud, DevOps & AI Engineering',
          learningPath: ['Linux', 'Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Python', 'LangChain', 'AI Agents', 'MCP Servers'],
          projectGoal: 'Build real-world AI and automation projects',
        },
        summary: 'QA → DevOps/AI transition. 4.1yr experience. Target skills: Linux, Docker, K8s, AWS, Terraform, Jenkins, Python, LangChain, AI Agents.',
      },
      {
        userId: user.id,
        memoryType: 'LEARNING',
        content: {
          english: {
            nativeLanguage: 'Telugu',
            currentLevel: 'intermediate',
            challenges: ['confidence', 'sentence formation speed', 'grammar accuracy', 'word recall during conversation'],
            goal: 'Professional English fluency and confidence',
          },
          kannada: {
            currentLevel: 'beginner',
            goal: 'Conversational Kannada for daily life and workplace in Bangalore',
          },
          commonMistakes: [],
          grammarScoreTrend: [],
          totalCorrections: 0,
        },
        summary: 'Telugu native. English: building confidence and fluency. Kannada: beginner, learning for Bangalore life/work.',
      },
    ],
  });

  console.log('✅ AI memory seeded (3 entries)');
  console.log('\nDone! Your AI coach now knows your full profile.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
