const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/clientsController');

const r = Router();
r.use(authenticate);

r.get('/vip',               c.getVip);
r.get('/',                  listLimiter, c.list);
r.post('/',                 c.create);
r.get('/:id',               c.getById);
r.patch('/:id',             c.update);
r.get('/:id/lifetime-value', c.getLifetimeValue);
r.post('/:id/referrals',    c.addReferral);

module.exports = r;
