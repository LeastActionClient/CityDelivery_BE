const crypto = require('crypto');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

/** Protects admin endpoints with a static key sent as `x-api-key` (timing-safe compare). */
function requireAdmin(req, _res, next) {
  if (!env.adminApiKey) return next(new AppError('Admin API is disabled.', 503));
  const provided = Buffer.from(String(req.get('x-api-key') || ''));
  const expected = Buffer.from(env.adminApiKey);
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) return next(new AppError('Unauthorized.', 401));
  next();
}

module.exports = { requireAdmin };
