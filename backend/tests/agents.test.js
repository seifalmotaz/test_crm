const request = require('supertest');
const app = require('../src/app');

const TS = Date.now();
const ADMIN_EMAIL  = `agents-admin-${TS}@example.com`;
const AGENT_EMAIL  = `agents-agent-${TS}@example.com`;
const PASSWORD     = 'Password123!';

let adminToken;
let agentToken;

beforeAll(async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ email: ADMIN_EMAIL, password: PASSWORD, role: 'admin' });
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: PASSWORD });
  adminToken = adminRes.body.data.accessToken;

  await request(app)
    .post('/api/auth/register')
    .send({ email: AGENT_EMAIL, password: PASSWORD, role: 'agent' });
  const agentRes = await request(app)
    .post('/api/auth/login')
    .send({ email: AGENT_EMAIL, password: PASSWORD });
  agentToken = agentRes.body.data.accessToken;
});

describe('POST /api/agents', () => {
  it('creates user + agent atomically as admin and returns 201', async () => {
    const email = `new-agent-${TS}@example.com`;
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'AgentPass123!',
        name:     'Test Agent',
        phone:    '555-0100',
        region:   'Downtown',
        tier:     'developing',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Agent');
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.tier).toBe('developing');
  });

  it('returns 403 when called by a user with agent role', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        email:    `forbidden-${TS}@example.com`,
        password: 'AgentPass123!',
        name:     'Should Fail',
        region:   'Downtown',
        tier:     'developing',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when the email is already taken', async () => {
    const email = `dup-agent-${TS}@example.com`;
    const payload = {
      email,
      password: 'AgentPass123!',
      name:     'Dup Agent',
      region:   'Downtown',
      tier:     'developing',
    };

    await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `missing-${TS}@example.com` });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with no auth token', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send({
        email:    `noauth-${TS}@example.com`,
        password: 'AgentPass123!',
        name:     'No Auth',
        region:   'Downtown',
        tier:     'developing',
      });

    expect(res.status).toBe(401);
  });
});
