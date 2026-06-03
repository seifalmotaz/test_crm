const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/dashboardController');

const r = Router();
r.use(authenticate);

r.get('/',              c.getSummary);         // alias for summary
r.get('/summary',       c.getSummary);
r.get('/revenue',       c.getRevenueTrend);    // ?months=12  (frontend alias)
r.get('/revenue-trend', c.getRevenueTrend);    // ?months=12
r.get('/pipeline',      c.getPipeline);
r.get('/top-agents',    c.getTopAgents);
r.get('/closing-soon',  c.getClosingSoon);     // ?days=30

module.exports = r;
