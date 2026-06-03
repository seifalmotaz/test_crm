const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/agentsController');

const r = Router();
r.use(authenticate);

r.post('/',                 requireRole('manager'), c.create);
r.get('/leaderboard',       c.getLeaderboard);
r.get('/',                  c.list);
r.get('/:id',               c.getById);
r.get('/:id/performance',   c.getPerformance);
r.get('/:id/deals',         c.getDeals);
r.get('/:id/leads',         c.getLeads);
r.get('/:id/commission',    c.getCommission);    // summary totals
r.get('/:id/commissions',   c.getCommissions);   // full record list (?status=hold|released|paid)
r.patch('/:id',             requireRole('manager'), c.update);

module.exports = r;
