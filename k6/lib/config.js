export const BASE_URL = (__ENV.K6_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export const API_PREFIX = '/api';

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${normalized}`;
}

export const TEST_EMAIL = __ENV.K6_TEST_EMAIL || 'k6-regression@package-boss.test';
export const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD || 'K6TestPass123!';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
