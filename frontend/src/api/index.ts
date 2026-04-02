import axios from 'axios';
import { router } from '@/router';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// JWT interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      const currentPath = window.location.pathname;
      // Don't redirect if already on login/setup — prevents infinite reload loop
      if (!currentPath.includes('/login') && !currentPath.includes('/setup')) {
        router.push('/login');
      }
    }
    return Promise.reject(error);
  },
);

export { api };

