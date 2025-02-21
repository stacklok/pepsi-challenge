export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const endpoints = {
  generate: `${API_URL}/api/generate`,
  user: `${API_URL}/auth/user`,
  login: `${API_URL}/auth/login`,
  logout: `${API_URL}/auth/logout`,
  is_admin: `${API_URL}/auth/is_admin`,
  submit_perference: `${API_URL}/api/submit-preference`,
  admin_stats: `${API_URL}/api/admin/stats`,
  user_stats: `${API_URL}/api/user/stats`,
  admin_results: `${API_URL}/api/admin/results`,
  admin_export: `${API_URL}/api/admin/export`,
};
