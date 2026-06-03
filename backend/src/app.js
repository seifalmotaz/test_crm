const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust nginx proxy (sets req.ip from X-Forwarded-For; required for express-rate-limit behind nginx)
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  credentials: true,
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
}

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Root — redirect browsers to the frontend; avoids confusing JSON 404 when someone visits port 5001 directly
app.get('/', (_req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(302, frontend);
});

// 404
app.use((_req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'Route not found' },
}));

// Global error handler
app.use(errorHandler);

module.exports = app;
