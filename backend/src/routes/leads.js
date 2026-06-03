const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/leadsController');

const r = Router();
r.use(authenticate);

r.get('/analytics/conversion', c.getConversionAnalytics);
r.get('/',                  listLimiter, c.list);
r.post('/',                 c.create);
r.get('/:id',               c.getById);
r.patch('/:id',             c.update);
r.delete('/:id',            requireRole('manager'), c.archive);
r.post('/:id/interactions',                           c.addInteraction);
r.get('/:id/interactions',                            c.getInteractions);
r.patch('/:id/interactions/:interactionId',  requireRole('manager'), c.updateInteraction);
r.delete('/:id/interactions/:interactionId', requireRole('manager'), c.deleteInteraction);
r.get('/:id/score',         c.getScore);
r.post('/:id/merge',        requireRole('manager'), c.merge);
r.post('/:id/convert',      c.convertToDeal);        // qualified lead → deal (atomic)

module.exports = r;
