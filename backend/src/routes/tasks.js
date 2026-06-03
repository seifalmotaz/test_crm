const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/tasksController');

const r = Router();
r.use(authenticate);

r.get('/overdue',           c.getOverdue);
r.post('/auto-generate',    requireRole('agent'), c.autoGenerate);
r.get('/',                  listLimiter, c.list);
r.post('/',                 c.create);
r.get('/:id',               c.getById);
r.patch('/:id',             c.update);
r.patch('/:id/complete',    c.complete);
r.delete('/:id',            requireRole('manager'), c.archive);

module.exports = r;
