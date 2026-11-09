const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { pageQuery, dates, boundedString } = require('../src/validation');
test('validation rejects bad strings and dates', () => {
  assert.throws(() => boundedString('', 'name'));
  assert.throws(() => dates({ from: 'yesterday' }));
  assert.deepEqual(pageQuery({ page: '0', limit: '1000' }), {
    page: 1,
    limit: 100,
    skip: 0,
  });
});
test('health check safely reports disconnected database state', async () => {
  const res = await request(createApp()).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', database: 'disconnected' });
  assert.equal(JSON.stringify(res.body).includes('mongodb'), false);
});
test('unknown API path returns a consistent JSON error', async () => {
  const res = await request(createApp()).get('/api/v1/not-a-resource');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
test('synthetic generator produces stable identifiers, cohorts, ranges, and timelines', () => {
  const { generate } = require('../src/seed/generate');
  const a = generate(),
    b = generate();
  assert.equal(a.length, 248);
  assert.equal(a[0].externalId, 'PT-001');
  assert.deepEqual(
    a.map((x) => [x.cohort, x.status, x.battery, x.doses, x.rescue]),
    b.map((x) => [x.cohort, x.status, x.battery, x.doses, x.rescue]),
  );
  assert.ok(
    a.every(
      (p) =>
        p.doses.length === 90 &&
        p.rescue.every((x) => x >= 0) &&
        p.battery >= 20 &&
        p.battery <= 100,
    ),
  );
});
