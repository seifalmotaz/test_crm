const { Router } = require('express');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/authController');

const r = Router();

r.post('/register', authLimiter, c.register);
r.post('/login',    authLimiter, c.login);
r.post('/refresh-token', refreshLimiter, c.refreshToken);
r.post('/logout',   authenticate, c.logout);
r.get('/me',        authenticate, c.me);

module.exports = r;
