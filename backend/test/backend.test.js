const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const { createApp } = require('../src/app');
const { pageQuery, dates, boundedString } = require('../src/validation');
const {
  hashPassword,
  verifyPassword,
  verifySession,
} = require('../src/auth/session');

async function testAuth(nodeEnv = 'test') {
  return {
    email: 'clinician@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    secret: 'test-only-session-secret-long-enough-1234567890',
    nodeEnv,
  };
}

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
  const auth = await testAuth();
  const app = createApp({ auth });
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .send({ email: auth.email, password: 'correct horse battery staple' })
    .expect(200);
  const res = await agent.get('/api/v1/not-a-resource');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('every registered page API endpoint rejects unauthenticated requests', async () => {
  const app = createApp({ auth: await testAuth() });
  const routes = [
    ['get', '/api/v1/events'],
    ['get', '/api/v1/adherence'],
    ['get', '/api/v1/analytics/overview'],
    ['get', '/api/v1/alerts'],
    ['patch', '/api/v1/alerts/AL-001'],
    ['post', '/api/v1/alerts/AL-001/acknowledge'],
    ['get', '/api/v1/data/imports'],
    ['post', '/api/v1/data/imports/validate'],
    ['get', '/api/v1/data/integrations'],
    ['get', '/api/v1/data/firmware'],
    ['post', '/api/v1/data/firmware/schedule'],
    ['get', '/api/v1/data/audit'],
    ['get', '/api/v1/devices'],
    ['get', '/api/v1/devices/DV-001'],
    ['patch', '/api/v1/devices/DV-001'],
    ['post', '/api/v1/devices/DV-001/sync'],
    ['post', '/api/v1/devices/sync'],
    ['get', '/api/v1/notes'],
    ['post', '/api/v1/notes'],
    ['get', '/api/v1/patients'],
    ['post', '/api/v1/patients'],
    ['get', '/api/v1/patients/PT-001'],
    ['patch', '/api/v1/patients/PT-001'],
    ['get', '/api/v1/patients/PT-001/timeline'],
    ['get', '/api/v1/reports'],
    ['post', '/api/v1/reports'],
    ['get', '/api/v1/reports/RP-001'],
    ['get', '/api/v1/reports/RP-001/export.csv'],
    ['delete', '/api/v1/reports/RP-001'],
  ];

  for (const [method, path] of routes) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 401, `${method.toUpperCase()} ${path}`);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
    assert.match(response.body.error.message, /not authenticated/i);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
});

test('login creates an HTTP-only session and authenticated requests reach APIs', async () => {
  const auth = await testAuth();
  const apiRouter = express.Router();
  apiRouter.get('/auth-probe', (req, res) =>
    res.json({ authenticated: true, email: req.auth.email }),
  );
  const agent = request.agent(createApp({ auth, apiRouter }));

  const login = await agent
    .post('/api/v1/auth/login')
    .send({
      email: auth.email.toUpperCase(),
      password: 'correct horse battery staple',
    })
    .expect(200);
  assert.equal(login.body.authenticated, true);
  assert.equal(login.headers['cache-control'], 'no-store');
  assert.match(login.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/i);

  await agent
    .get('/api/v1/auth-probe')
    .expect(200, { authenticated: true, email: auth.email });
  await agent
    .get('/api/v1/auth/session')
    .expect(200, { authenticated: true, email: auth.email });
});

test('production sessions use secure cookies and logout removes the browser session', async () => {
  const auth = await testAuth('production');
  const apiRouter = express.Router();
  apiRouter.get('/auth-probe', (_req, res) => res.json({ ok: true }));
  const app = createApp({ auth, apiRouter });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: auth.email, password: 'correct horse battery staple' })
    .expect(200);
  assert.match(login.headers['set-cookie'][0], /; Secure/i);
  const sessionCookie = login.headers['set-cookie'][0].split(';')[0];
  await request(app)
    .get('/api/v1/auth-probe')
    .set('Cookie', sessionCookie)
    .expect(200, { ok: true });

  const testAuthConfig = await testAuth();
  const logoutAgent = request.agent(
    createApp({ auth: testAuthConfig, apiRouter }),
  );
  await logoutAgent
    .post('/api/v1/auth/login')
    .send({
      email: testAuthConfig.email,
      password: 'correct horse battery staple',
    })
    .expect(200);
  await logoutAgent
    .post('/api/v1/auth/logout')
    .expect(200, { authenticated: false });
  await logoutAgent.get('/api/v1/auth-probe').expect(401);
});

test('invalid credentials are rejected without revealing which field was wrong', async () => {
  const auth = await testAuth();
  const response = await request(createApp({ auth }))
    .post('/api/v1/auth/login')
    .send({ email: 'other@example.com', password: 'wrong password' })
    .expect(401);
  assert.deepEqual(response.body.error, {
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect.',
  });
});

test('protected API fails closed when authentication is not configured', async () => {
  const response = await request(createApp({ auth: {} })).get(
    '/api/v1/patients',
  );
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'AUTH_NOT_CONFIGURED');
});

test('password hashes and signed sessions reject tampered or incorrect values', async () => {
  const auth = await testAuth();
  assert.equal(
    await verifyPassword('correct horse battery staple', auth.passwordHash),
    true,
  );
  assert.equal(
    await verifyPassword('incorrect password', auth.passwordHash),
    false,
  );
  const { signSession } = require('../src/auth/session');
  const token = signSession(auth.email, auth.secret);
  assert.equal(verifySession(token, auth.secret)?.email, auth.email);
  assert.equal(verifySession(`${token}tampered`, auth.secret), null);
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
