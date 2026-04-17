import api from './api';

export const analyticsService = {
  getSkillGaps: () => api.get('/analytics-service/skill-gaps'),
  getHighPotentials: () => api.get('/analytics-service/high-potentials'),
  getAttritionRisks: () => api.get('/analytics-service/attrition-risks'),
  getSkillsDistribution: () => api.get('/analytics-service/distribution/skills'),
  getTeamSummary: () => api.get('/analytics-service/team-summary'),
  getTeamsOverview: () => api.get('/analytics-service/teams-overview'),
};
