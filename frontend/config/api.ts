export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const endpoints = {
  generate: `${API_URL}/api/generate`,
  user: `${API_URL}/auth/user`,
  login: `${API_URL}/auth/login`,
  logout: `${API_URL}/auth/logout`,
};
