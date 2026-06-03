const prisma = require('../lib/prisma');
const ai = require('./ai');
const memory = require('./memory');
const { CAREER_ROADMAP } = require('../data/prompts');

async function logStudy(userId, data) {
  const log = await prisma.studyLog.create({
    data: { userId, topic: data.topic, subtopics: data.subtopics || [], durationMin: data.durationMin, notes: data.notes, resources: data.resources || [] },
  });
  await memory.updateCareerMemory(userId, data);
  return log;
}

async function getStudyHistory(userId) {
  return prisma.studyLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 });
}

async function getRoadmap(userId) {
  const careerMem = await prisma.aIMemory.findUnique({ where: { userId_memoryType: { userId, memoryType: 'CAREER' } } });
  const careerData = careerMem?.content || {};
  const topicsProgress = careerData.topicsProgress || {};

  const roadmapWithProgress = CAREER_ROADMAP.map(item => {
    const minutesStudied = topicsProgress[item.topic] || 0;
    const hoursStudied = Math.round(minutesStudied / 60);
    const completion = Math.min(100, Math.round((hoursStudied / item.estimatedHours) * 100));
    return { ...item, hoursStudied, completion, status: completion >= 100 ? 'completed' : completion > 0 ? 'in-progress' : 'not-started' };
  });

  const careerScore = Math.round(roadmapWithProgress.reduce((a, t) => a + t.completion, 0) / CAREER_ROADMAP.length);

  return { roadmap: roadmapWithProgress, careerScore, totalHours: careerData.totalHours || 0, currentTopic: careerData.currentTopic || 'Docker' };
}

async function careerChat(userId, message) { return ai.careerCoach(userId, message); }

async function getCareerStats(userId) {
  const logs = await prisma.studyLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 });
  const totalMinutes = logs.reduce((a, l) => a + l.durationMin, 0);
  const last7Days = logs.filter(l => new Date(l.loggedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const weeklyHours = Math.round(last7Days.reduce((a, l) => a + l.durationMin, 0) / 60);
  const topicCounts = {};
  logs.forEach(l => { topicCounts[l.topic] = (topicCounts[l.topic] || 0) + l.durationMin; });
  return { totalHours: Math.round(totalMinutes / 60), weeklyHours, studyDaysThisMonth: logs.length, topicBreakdown: topicCounts, recentLogs: logs.slice(0, 7) };
}

module.exports = { logStudy, getStudyHistory, getRoadmap, careerChat, getCareerStats };
