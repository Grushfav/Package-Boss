import http from 'k6/http';

import { apiUrl, defaultHeaders, TEST_EMAIL, TEST_PASSWORD } from './config.js';

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

export function authGet(path, token) {
  return http.get(apiUrl(path), {
    headers: {
      ...defaultHeaders,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function ensureTestUser(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const loginRes = jsonPost('/auth/login', { email, password }, {}, [200, 401]);
  if (loginRes.status === 200) {
    return loginRes.json('access_token');
  }

  const registerRes = jsonPost('/auth/register', {
    first_name: 'K6',
    last_name: 'Regression',
    email,
    password,
    contact_number: '+18765551234',
    parish: 'Kingston',
    accept_terms: true,
  }, {}, [201, 409]);

  if (registerRes.status === 201) {
    return registerRes.json('access_token');
  }

  if (registerRes.status === 409) {
    const retryLogin = jsonPost('/auth/login', { email, password });
    if (retryLogin.status === 200) {
      return retryLogin.json('access_token');
    }
  }

  throw new Error(
    `Could not obtain test token for ${email} (login ${loginRes.status}, register ${registerRes.status})`,
  );
}
