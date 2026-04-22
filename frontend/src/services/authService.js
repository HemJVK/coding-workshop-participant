import api from './api';

export const authService = {
  login: (data) => api.post('/auth-service/login', data),
  getCaptcha: () => api.get('/auth-service/captcha'),
  saveSession: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  getMe: () => api.get('/auth-service/me'),
};
