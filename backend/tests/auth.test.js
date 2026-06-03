const request = require('supertest');
const app = require('../src/app');

const EMAIL    = 'auth-test@example.com';
const PASSWORD = 'Password123!';
let token;

beforeAll(async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ email: EMAIL, password: PASSWORD, role: 'agent' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: PASSWORD });

  token = res.body.data.accessToken;
});

describe('POST /api/auth/login', () => {
  it('returns 200 and accessToken with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 200 and user object with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(EMAIL);
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
