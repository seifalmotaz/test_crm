const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/notificationsController');

const r = Router();
r.use(authenticate);

r.get('/',                c.list);
r.post('/read-all',       c.markAllRead);
r.patch('/:id/read',      c.markRead);

module.exports = r;
