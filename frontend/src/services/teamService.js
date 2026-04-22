import api from './api';

const base = '/teams-service';

export const teamService = {
  list: (params) => api.get(base, { params }),
  get: (id) => api.get(`${base}/${id}`),
  create: (data) => api.post(base, data),
  update: (id, data) => api.put(`${base}/${id}`, data),
  delete: (id) => api.delete(`${base}/${id}`),

  listMembers: (teamId) => api.get(`${base}/${teamId}/members`),
  addMember: (teamId, data) => api.post(`${base}/${teamId}/members`, data),
  updateMember: (teamId, employeeId, data) => api.put(`${base}/${teamId}/members/${employeeId}`, data),
  removeMember: (teamId, employeeId) => api.delete(`${base}/${teamId}/members/${employeeId}`),

  listAchievements: (teamId) => api.get(`${base}/${teamId}/achievements`),
  createAchievement: (teamId, data) => api.post(`${base}/${teamId}/achievements`, data),
  updateAchievement: (teamId, achievementId, data) => api.put(`${base}/${teamId}/achievements/${achievementId}`, data),
  deleteAchievement: (teamId, achievementId) => api.delete(`${base}/${teamId}/achievements/${achievementId}`),

  listMetadata: (teamId) => api.get(`${base}/${teamId}/metadata`),
  createMetadata: (teamId, data) => api.post(`${base}/${teamId}/metadata`, data),
  updateMetadata: (teamId, metadataId, data) => api.put(`${base}/${teamId}/metadata/${metadataId}`, data),
  deleteMetadata: (teamId, metadataId) => api.delete(`${base}/${teamId}/metadata/${metadataId}`),
};
