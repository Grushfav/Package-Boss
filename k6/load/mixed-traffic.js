import { check, sleep } from 'k6';

import { jsonGet } from '../lib/http.js';

const estimateWeights = [2.5, 5, 8.2, 12, 18, 25, 33, 41, 48];

export const options = {
  scenarios: {
    landing_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 40,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 12 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200'],
    'http_req_duration{endpoint:estimate}': ['p(95)<1500'],
  },
  tags: { test_type: 'load' },
};

export default function () {
  const roll = Math.random();

  if (roll < 0.15) {
    const res = jsonGet('/health', { tags: { endpoint: 'health' } });
    check(res, { 'health ok': (r) => r.status === 200 });
  } else if (roll < 0.3) {
    const res = jsonGet('/parishes', { tags: { endpoint: 'parishes' } });
    check(res, { 'parishes ok': (r) => r.status === 200 });
  } else if (roll < 0.55) {
    const res = jsonGet('/rates', { tags: { endpoint: 'rates' } });
    check(res, { 'rates ok': (r) => r.status === 200 });
  } else {
    const weight = estimateWeights[__ITER % estimateWeights.length];
    const res = jsonGet(`/rates/estimate?weight_lbs=${weight}`, {
      tags: { endpoint: 'estimate' },
    });
    check(res, {
      'estimate ok or rate limited': (r) => r.status === 200 || r.status === 429,
    });
  }

  sleep(0.2 + Math.random() * 0.5);
}
