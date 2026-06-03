const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/filesController');

const r = Router();
r.use(authenticate);

r.post('/upload', uploadLimiter, c.upload);
r.get('/',        c.listByEntity);
r.get('/:id',     c.getFile);
r.delete('/:id',  c.deleteFile);

module.exports = r;
