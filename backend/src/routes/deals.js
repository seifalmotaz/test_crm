const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/dealsController');

const r = Router();
r.use(authenticate);

r.get('/closing-soon',        c.getClosingSoon);
r.get('/',                    listLimiter, c.list);
r.post('/',                   requireRole('agent'), c.create);
r.get('/:id',                 c.getById);
r.patch('/:id',               c.update);
r.post('/:id/stage',          c.updateStage);
r.patch('/:id/probability',   c.updateProbability);
r.get('/:id/commission',      c.getCommission);
r.post('/:id/documents',      uploadLimiter, c.uploadDocument);
r.get('/:id/documents',       c.listDocuments);
r.get('/:id/actions',         c.listActions);
r.post('/:id/actions',        c.addAction);

module.exports = r;
