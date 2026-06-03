const { Router } = require('express');
const { globalLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.use(globalLimiter);

router.use('/auth',       require('./auth'));
router.use('/dashboard',  require('./dashboard'));
router.use('/properties', require('./properties'));
router.use('/leads',      require('./leads'));
router.use('/deals',      require('./deals'));
router.use('/agents',     require('./agents'));
router.use('/clients',    require('./clients'));
router.use('/tasks',      require('./tasks'));
router.use('/analytics',  require('./analytics'));
router.use('/files',         require('./files'));
router.use('/notifications', require('./notifications'));
router.use('/users',         require('./users'));
router.use('/admin',         require('./admin'));
router.use('/chat',          require('./chat'));

module.exports = router;
