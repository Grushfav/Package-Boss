import { check, group, sleep } from 'k6';
import http from 'k6/http';

import { BASE_URL } from '../lib/config.js';
import {
  authGet,
  authPost,
  ensureTestUser,
  jsonGet,
  jsonPost,
  requireAdminLogin,
  requireClerkLogin,
} from '../lib/http.js';
import {
  runAdminFeatureTests,
  runClerkFeatureTests,
  runStaffAccessControlTests,
} from './staff-admin.js';

/**
 * Known values from server/src/data/revisedRateTable.ts (revised-rates-newest).
 * Keep in sync with server/tests/contract/rates.test.ts.
 */
const RATES_REVISION = 'revised-rates-newest';
const JMD_PER_USD = 160;
const TIER_1_USD = 4.375;
const TIER_1_JMD = 700;
const ESTIMATE_WEIGHT = 7.3;
const ESTIMATE_BILLABLE = 8;
const ESTIMATE_USD = 22.19; // Math.round(22.1875 * 100) / 100
const ESTIMATE_JMD = 3550;

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

  const customerToken = ensureTestUser();
  const admin = requireAdminLogin();
  const clerk = requireClerkLogin();

  return {
    token: customerToken,
    adminToken: admin.token,
    clerkToken: clerk.token,
  };
}

export default function ({ token, adminToken, clerkToken }) {
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
      'parishes includes St. Andrew': (r) => r.json('parishes').includes('St. Andrew'),
      'parishes count 14': (r) => r.json('parishes').length === 14,
    });
  });

  group('Rates table', () => {
    const res = jsonGet('/rates');
    const tier1 = res.json('tiers.0');
    check(res, {
      'rates status 200': (r) => r.status === 200,
      'rates currency USD': (r) => r.json('currency') === 'USD',
      'rates revision newest': (r) => r.json('rates_revision') === RATES_REVISION,
      'rates jmd per usd': (r) => r.json('jmd_per_usd') === JMD_PER_USD,
      'rates has 50 tiers': (r) => Array.isArray(r.json('tiers')) && r.json('tiers').length === 50,
      'rates max auto lbs': (r) => r.json('max_auto_rate_lbs') === 50,
      'rates 1lb usd': () => tier1 && tier1.cost_usd === TIER_1_USD,
      'rates 1lb jmd': () => tier1 && tier1.cost_jmd === TIER_1_JMD,
      'rates formula mentions specialized': (r) =>
        String(r.json('formula_note') || '').includes('1–50') ||
        String(r.json('quote_note') || '').toLowerCase().includes('specialized'),
    });
  });

  group('Rates estimate', () => {
    const res = jsonGet(`/rates/estimate?weight_lbs=${ESTIMATE_WEIGHT}`);
    check(res, {
      'estimate status 200': (r) => r.status === 200,
      'estimate billable weight ceil': (r) => r.json('billable_weight_lbs') === ESTIMATE_BILLABLE,
      'estimate cost_usd': (r) => r.json('cost_usd') === ESTIMATE_USD,
      'estimate cost_jmd': (r) => r.json('cost_jmd') === ESTIMATE_JMD,
      'estimate jmd per usd': (r) => r.json('jmd_per_usd') === JMD_PER_USD,
      'estimate quote specialized': (r) =>
        String(r.json('quote_note') || '')
          .toLowerCase()
          .includes('specialized'),
    });

    const bad = jsonGet('/rates/estimate', {}, 400);
    check(bad, {
      'estimate missing param 400': (r) => r.status === 400,
      'estimate missing mentions weight_lbs': (r) =>
        String(r.json('error') || '').toLowerCase().includes('weight_lbs'),
    });

    const heavy = jsonGet('/rates/estimate?weight_lbs=51', {}, 400);
    check(heavy, {
      'estimate over 50lbs 400': (r) => r.status === 400,
      'estimate over 50lbs specialized': (r) =>
        String(r.json('error') || '')
          .toLowerCase()
          .includes('specialized'),
    });
  });

  group('Auth validation', () => {
    const missingLogin = jsonPost('/auth/login', {}, {}, 400);
    check(missingLogin, {
      'login missing credentials 400': (r) => r.status === 400,
      'login missing message': (r) =>
        String(r.json('error') || '').includes('Email and password are required'),
    });

    const badLogin = jsonPost(
      '/auth/login',
      { email: 'nope@example.com', password: 'wrong-password' },
      {},
      401,
    );
    check(badLogin, {
      'invalid login 401': (r) => r.status === 401,
    });

    const missingRegister = jsonPost('/auth/register', { email: 'a@b.com' }, {}, 400);
    check(missingRegister, {
      'register missing fields 400': (r) => r.status === 400,
      'register missing mentions fields': (r) =>
        String(r.json('error') || '').includes('Missing required fields'),
    });
  });

  group('Auth errors', () => {
    const noToken = jsonGet('/me', {}, 401);
    check(noToken, {
      'me without token 401': (r) => r.status === 401,
      'me without token message': (r) => r.json('error') === 'Authentication required',
    });

    const badToken = http.get(`${BASE_URL}/api/me`, {
      headers: {
        ...{ 'Content-Type': 'application/json', Accept: 'application/json' },
        Authorization: 'Bearer not-a-jwt',
      },
      responseCallback: http.expectedStatuses(401),
    });
    check(badToken, {
      'me bad token 401': (r) => r.status === 401,
      'me bad token message': (r) => r.json('error') === 'Invalid token',
    });
  });

  group('Social auth validation', () => {
    const google = jsonPost('/auth/google', {}, {}, 400);
    check(google, {
      'google without credential 400': (r) => r.status === 400,
      'google error mentions credential': (r) =>
        String(r.json('error') || '')
          .toLowerCase()
          .includes('credential') ||
        String(r.json('error') || '')
          .toLowerCase()
          .includes('access token'),
    });

    const facebook = jsonPost('/auth/facebook', {}, {}, 400);
    check(facebook, {
      'facebook without token 400': (r) => r.status === 400,
      'facebook error present': (r) => Boolean(r.json('error')),
    });
  });

  group('Announcements (public)', () => {
    const res = jsonGet('/announcements/active?context=public');
    check(res, {
      'active announcements 200': (r) => r.status === 200,
      'active announcements has banner key': (r) => 'banner' in r.json(),
      'active announcements has modals array': (r) => Array.isArray(r.json('modals')),
    });

    const badCtx = jsonGet('/announcements/active?context=nope', {}, 400);
    check(badCtx, {
      'active announcements bad context 400': (r) => r.status === 400,
    });
  });

  group('Authenticated customer API', () => {
    const me = authGet('/me', token);
    check(me, {
      'me status 200': (r) => r.status === 200,
      'me has user email': (r) => typeof r.json('user.email') === 'string',
      'me has shipping_id': (r) => typeof r.json('user.shipping_id') === 'string',
      'me shipping_id format': (r) => /^BOSS-\d+$/.test(r.json('user.shipping_id')),
      'me role customer': (r) => r.json('user.role') === 'customer',
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

    const shippers = authGet('/me/shippers', token);
    check(shippers, {
      'shippers status 200': (r) => r.status === 200,
      'shippers is array': (r) => Array.isArray(r.json('shippers')),
    });

    const deliveryAddresses = authGet('/me/delivery-addresses', token);
    check(deliveryAddresses, {
      'delivery addresses status 200': (r) => r.status === 200,
      'delivery addresses is array': (r) => Array.isArray(r.json('addresses')),
    });

    const authorizedPickups = authGet('/me/authorized-pickups', token);
    check(authorizedPickups, {
      'authorized pickups status 200': (r) => r.status === 200,
      'authorized pickups is array': (r) => Array.isArray(r.json('pickups')),
    });

    const inbox = authGet('/me/announcements', token);
    check(inbox, {
      'inbox announcements status 200': (r) => r.status === 200,
      'inbox announcements is array': (r) => Array.isArray(r.json('announcements')),
    });

    const deliveryRequests = authGet('/me/delivery-requests', token);
    check(deliveryRequests, {
      'delivery requests status 200': (r) => r.status === 200,
      'delivery requests is array': (r) => Array.isArray(r.json('delivery_requests')),
    });

    const bankProofs = authGet('/me/bank-transfer-proofs', token);
    check(bankProofs, {
      'bank transfer proofs status 200': (r) => r.status === 200,
      'bank transfer proofs is array': (r) => Array.isArray(r.json('proofs')),
    });

    // Pickup does not require delivery_address_id; empty package list should fail validation.
    const pickupEmpty = authPost(
      '/me/delivery-requests',
      token,
      { package_ids: [], fulfillment_type: 'pickup' },
      400,
    );
    check(pickupEmpty, {
      'pickup empty packages 400': (r) => r.status === 400,
      'pickup empty packages message': (r) =>
        String(r.json('error') || '')
          .toLowerCase()
          .includes('package'),
    });

    // Home delivery still requires an address when packages would otherwise be valid.
    const deliveryNoAddress = authPost(
      '/me/delivery-requests',
      token,
      {
        package_ids: ['00000000-0000-0000-0000-000000000001'],
        fulfillment_type: 'delivery',
      },
      400,
    );
    check(deliveryNoAddress, {
      'delivery without address 400': (r) => r.status === 400,
      'delivery without address message': (r) => {
        const err = String(r.json('error') || '').toLowerCase();
        return (
          err.includes('delivery_address_id') ||
          err.includes('not found') ||
          err.includes('package')
        );
      },
    });
  });

  runStaffAccessControlTests({ customerToken: token, clerkToken, adminToken });
  runClerkFeatureTests({ clerkToken });
  runAdminFeatureTests({ adminToken });

  sleep(0.1);
}
