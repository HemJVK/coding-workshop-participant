import api from './api';
const base = '/reviews-service';
export const reviewService = {
  list: (params) => api.get(base, { params }),
  get: (id) => api.get(`${base}/${id}`),
  create: (data) => api.post(base, data),
  update: (id, data) => api.put(`${base}/${id}`, data),
  delete: (id) => api.delete(`${base}/${id}`),
};
