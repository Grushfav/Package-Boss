import { check, sleep } from 'k6';

import { jsonGet } from '../lib/http.js';

export const options = {
  scenarios: {
    public_read_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
  tags: { test_type: 'load' },
};

export default function () {
  const pick = __ITER % 3;

  if (pick === 0) {
    const res = jsonGet('/health');
    check(res, {
      'health ok': (r) => r.status === 200 && r.json('status') === 'ok',
    });
  } else if (pick === 1) {
    const res = jsonGet('/parishes');
    check(res, {
      'parishes ok': (r) => r.status === 200 && Array.isArray(r.json('parishes')),
    });
  } else {
    const res = jsonGet('/rates');
    check(res, {
      'rates ok': (r) => r.status === 200 && r.json('currency') === 'USD',
    });
  }

  sleep(0.3 + Math.random() * 0.7);
}
