const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/propertiesController');

const r = Router();
r.use(authenticate);

r.get('/',                  listLimiter, c.list);
r.post('/',                 requireRole('agent'), c.create);
r.get('/:id',               c.getById);
r.patch('/:id',             c.update);
r.delete('/:id',            requireRole('manager'), c.softDelete);
r.get('/:id/comps',         c.getComps);
r.get('/:id/market-analysis', c.getMarketAnalysis);
r.post('/:id/photos',       uploadLimiter, requireRole('agent'), c.uploadPhotos);
r.post('/:id/status',       c.changeStatus);
r.post('/:id/view',         c.recordView);

module.exports = r;
