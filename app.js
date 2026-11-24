const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { env } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const requestRoutes = require('./routes/requestRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const riderRoutes = require('./routes/riderRoutes');
const riderAdminRoutes = require('./routes/riderAdminRoutes');
const franchiseRoutes = require('./routes/franchiseRoutes');
const franchiseAdminRoutes = require('./routes/franchiseAdminRoutes');
const franchiseWebhookRoutes = require('./routes/franchiseWebhookRoutes');

const app = express();

app.disable('x-powered-by');
if (env.trustProxy !== '0') {
  const n = Number(env.trustProxy);
  app.set('trust proxy', Number.isNaN(n) ? env.trustProxy : n);
}

app.use(
  helmet({
    // Product images live on Cloudinary and are shown by the separate frontend origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (curl, health checks) that send no Origin header.
      if (!origin) return cb(null, true);
      const normalized = String(origin).replace(/\/+$/, '').toLowerCase();
      if (env.frontendOrigins.includes(normalized)) return cb(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-rider-sensitive-key', 'x-admin-actor', 'x-admin-role'],
    optionsSuccessStatus: 204,
    maxAge: 600,
  })
);

// Cashfree signs the exact raw body. Mount this before express.json().
app.use(
  '/api/franchises/webhook',
  apiLimiter,
  express.raw({ type: 'application/json', limit: '1mb' }),
  franchiseWebhookRoutes
);

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'City Delivery Services API',
    status: 'online',
    health: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    smtpConfigured: env.smtpConfigured,
    cloudinaryConfigured: env.cloudinaryConfigured,
    cashfreeConfigured: env.cashfreeConfigured,
  });
});

app.use('/api', apiLimiter);
app.use('/api/requests', requestRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/admin', riderAdminRoutes);
app.use('/api/franchises', franchiseRoutes);
app.use('/api/admin', franchiseAdminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
