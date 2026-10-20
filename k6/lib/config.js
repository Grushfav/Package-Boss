export const BASE_URL = (__ENV.K6_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
export const API_PREFIX = '/api';

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${normalized}`;
}

/** Customer regression account (auto-registered if missing). */
export const TEST_EMAIL = __ENV.K6_TEST_EMAIL || 'k6-regression@package-boss.test';
export const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD || 'K6TestPass123!';

/**
 * Staff accounts — must be seeded (see server/scripts/seedTestUsers.ts).
 * Defaults match the seed script.
 */
export const STAFF_PASSWORD = __ENV.K6_STAFF_PASSWORD || 'TestPass123!';
export const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || 'admin@package-boss.test';
export const CLERK_EMAIL = __ENV.K6_CLERK_EMAIL || 'clerk@package-boss.test';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
