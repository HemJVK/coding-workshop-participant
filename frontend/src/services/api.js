import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: `${API_URL}/api` });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('acme_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('acme_token');
      localStorage.removeItem('acme_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
