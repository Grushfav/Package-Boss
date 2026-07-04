import { check, group, sleep } from 'k6';
import http from 'k6/http';

import { BASE_URL } from '../lib/config.js';
import { authGet, ensureTestUser, jsonGet, jsonPost } from '../lib/http.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
  },
  tags: { test_type: 'regression' },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/health`, { timeout: '10s' });
  if (res.status !== 200) {
    throw new Error(`API not reachable at ${BASE_URL} (status ${res.status})`);
  }

  return {
    token: ensureTestUser(),
  };
}

export default function ({ token }) {
  group('Health', () => {
    const res = jsonGet('/health');
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => r.json('status') === 'ok',
      'health service name': (r) => r.json('service') === 'package-boss-api',
    });
  });

  group('Parishes', () => {
    const res = jsonGet('/parishes');
    check(res, {
      'parishes status 200': (r) => r.status === 200,
      'parishes includes Kingston': (r) => {
        const parishes = r.json('parishes');
        return Array.isArray(parishes) && parishes.includes('Kingston');
      },
      'parishes count 14': (r) => r.json('parishes').length === 14,
    });
  });

  group('Rates table', () => {
    const res = jsonGet('/rates');
    check(res, {
      'rates status 200': (r) => r.status === 200,
      'rates currency USD': (r) => r.json('currency') === 'USD',
      'rates has tiers': (r) => Array.isArray(r.json('tiers')) && r.json('tiers').length === 50,
      'rates max auto lbs': (r) => r.json('max_auto_rate_lbs') === 50,
    });
  });

  group('Rates estimate', () => {
    const res = jsonGet('/rates/estimate?weight_lbs=7.3');
    check(res, {
      'estimate status 200': (r) => r.status === 200,
      'estimate billable weight ceil': (r) => r.json('billable_weight_lbs') === 8,
      'estimate has cost_usd': (r) => typeof r.json('cost_usd') === 'number',
      'estimate has cost_jmd': (r) => typeof r.json('cost_jmd') === 'number',
    });

    const bad = jsonGet('/rates/estimate', {}, 400);
    check(bad, {
      'estimate missing param 400': (r) => r.status === 400,
    });
  });

  group('Auth validation', () => {
    const res = jsonPost(
      '/auth/login',
      { email: 'nope@example.com', password: 'wrong-password' },
      {},
      401,
    );
    check(res, {
      'invalid login 401': (r) => r.status === 401,
    });
  });

  group('Authenticated customer API', () => {
    const me = authGet('/me', token);
    check(me, {
      'me status 200': (r) => r.status === 200,
      'me has user email': (r) => typeof r.json('user.email') === 'string',
      'me has shipping_id': (r) => typeof r.json('user.shipping_id') === 'string',
      'me shipping_id format': (r) => /^BOSS-\d+$/.test(r.json('user.shipping_id')),
    });

    const shipping = authGet('/me/shipping-address', token);
    check(shipping, {
      'shipping address status 200': (r) => r.status === 200,
      'shipping address has boss id': (r) => typeof r.json('shipping_id') === 'string',
    });

    const packages = authGet('/me/packages', token);
    check(packages, {
      'packages status 200': (r) => r.status === 200,
      'packages is array': (r) => Array.isArray(r.json('packages')),
    });

    const preAlerts = authGet('/me/pre-alerts', token);
    check(preAlerts, {
      'pre-alerts status 200': (r) => r.status === 200,
      'pre-alerts is array': (r) => Array.isArray(r.json('pre_alerts')),
    });
  });

  sleep(0.1);
}
