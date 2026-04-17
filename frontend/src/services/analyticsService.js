import api from './api';

export const analyticsService = {
  getSkillGaps: () => api.get('/api/analytics-service/skill-gaps'),
  getHighPotentials: () => api.get('/api/analytics-service/high-potentials'),
  getAttritionRisks: () => api.get('/api/analytics-service/attrition-risks'),
  getSkillsDistribution: () => api.get('/api/analytics-service/distribution/skills'),
  getTeamSummary: () => api.get('/api/analytics-service/team-summary'),
  getTeamsOverview: () => api.get('/api/analytics-service/teams-overview'),
};
