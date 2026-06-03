const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/usersController');

const r = Router();
r.use(authenticate);

// managers may create/list their own agents; everything else is admin-only
r.post('/',              requireRole('manager'), c.create);
r.get('/',               requireRole('manager'), c.list);

r.use(requireRole('admin'));
r.patch('/:id/profile',  c.updateProfile);
r.patch('/:id/quota',    c.updateQuota);
r.patch('/:id/role',     c.updateRole);
r.patch('/:id/status',   c.toggleStatus);
r.patch('/:id/features', c.updateFeatures);
r.delete('/:id',         c.deleteUser);

module.exports = r;
