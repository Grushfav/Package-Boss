import http from 'k6/http';

import {
  ADMIN_EMAIL,
  apiUrl,
  CLERK_EMAIL,
  defaultHeaders,
  STAFF_PASSWORD,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './config.js';

function withExpectedStatus(params, expectedStatus) {
  const requestOptions = {
    headers: defaultHeaders,
    ...params,
  };

  if (expectedStatus !== undefined) {
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    requestOptions.responseCallback = http.expectedStatuses(...statuses);
  }

  return requestOptions;
}

function authHeaders(token) {
  return {
    ...defaultHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export function jsonGet(path, params = {}, expectedStatus = undefined) {
  return http.get(apiUrl(path), withExpectedStatus(params, expectedStatus));
}

export function jsonPost(path, body, params = {}, expectedStatus = undefined) {
  return http.post(
    apiUrl(path),
    JSON.stringify(body),
    withExpectedStatus(params, expectedStatus),
  );
}

export function authGet(path, token, expectedStatus = undefined) {
  return http.get(
    apiUrl(path),
    withExpectedStatus({ headers: authHeaders(token) }, expectedStatus),
  );
}

export function authPost(path, token, body, expectedStatus = undefined) {
  return http.post(
    apiUrl(path),
    JSON.stringify(body),
    withExpectedStatus({ headers: authHeaders(token) }, expectedStatus),
  );
}

export function authPatch(path, token, body, expectedStatus = undefined) {
  return http.patch(
    apiUrl(path),
    JSON.stringify(body),
    withExpectedStatus({ headers: authHeaders(token) }, expectedStatus),
  );
}

export function authDelete(path, token, expectedStatus = undefined) {
  return http.del(
    apiUrl(path),
    null,
    withExpectedStatus({ headers: authHeaders(token) }, expectedStatus),
  );
}

export function loginUser(email, password, expectedStatus = [200, 401]) {
  return jsonPost('/auth/login', { email, password }, {}, expectedStatus);
}

export function ensureTestUser(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const loginRes = loginUser(email, password);
  if (loginRes.status === 200) {
    return loginRes.json('access_token');
  }

  const registerRes = jsonPost(
    '/auth/register',
    {
      first_name: 'K6',
      last_name: 'Regression',
      email,
      password,
      contact_number: '+18765551234',
      parish: 'Kingston',
      accept_terms: true,
    },
    {},
    [201, 409],
  );

  if (registerRes.status === 201) {
    return registerRes.json('access_token');
  }

  if (registerRes.status === 409) {
    const retryLogin = loginUser(email, password);
    if (retryLogin.status === 200) {
      return retryLogin.json('access_token');
    }
  }

  throw new Error(
    `Could not obtain test token for ${email} (login ${loginRes.status}, register ${registerRes.status}: ${registerRes.body})`,
  );
}

/**
 * Staff accounts cannot self-register. Seed via:
 *   npx tsx scripts/seedTestUsers.ts
 */
export function requireStaffLogin(email, password = STAFF_PASSWORD, roleLabel = 'staff') {
  const loginRes = loginUser(email, password);
  if (loginRes.status !== 200) {
    throw new Error(
      `Could not log in ${roleLabel} ${email} (status ${loginRes.status}). ` +
        'Seed staff users first: cd server && npx tsx scripts/seedTestUsers.ts',
    );
  }
  const token = loginRes.json('access_token');
  const role = loginRes.json('user.role');
  if (roleLabel === 'admin' && role !== 'admin') {
    throw new Error(`Expected admin role for ${email}, got ${role}`);
  }
  if (roleLabel === 'clerk' && role !== 'clerk' && role !== 'admin') {
    throw new Error(`Expected clerk role for ${email}, got ${role}`);
  }
  return { token, user: loginRes.json('user') };
}

export function requireAdminLogin() {
  return requireStaffLogin(ADMIN_EMAIL, STAFF_PASSWORD, 'admin');
}

export function requireClerkLogin() {
  return requireStaffLogin(CLERK_EMAIL, STAFF_PASSWORD, 'clerk');
}
