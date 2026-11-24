const crypto = require('crypto');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');
const { FRANCHISE_ADMIN_ROLES } = require('../utils/constants');

/** Protects admin endpoints with a static key sent as `x-api-key` (timing-safe compare). */
function requireAdmin(req, _res, next) {
  if (!env.adminApiKey) return next(new AppError('Admin API is disabled.', 503));
  const provided = Buffer.from(String(req.get('x-api-key') || ''));
  const expected = Buffer.from(env.adminApiKey);
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) return next(new AppError('Unauthorized.', 401));
  next();
}

function riderKeyMatches(req) {
  if (!env.riderSensitiveApiKey) return false;
  const provided = Buffer.from(String(req.get('x-rider-sensitive-key') || ''));
  const expected = Buffer.from(env.riderSensitiveApiKey);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function sensitiveKeyRejected() {
  return new AppError('The sensitive data key was not accepted. Review will continue with private fields hidden.', 403, {
    sensitiveKey: 'Check the sensitive data key or clear it to continue with hidden fields.',
  });
}

function requireRiderSensitiveAccess(req, _res, next) {
  if (!env.riderSensitiveApiKey) return next(new AppError('Sensitive rider data access is disabled.', 503));
  if (!riderKeyMatches(req)) return next(sensitiveKeyRejected());
  next();
}

function optionalRiderSensitiveAccess(req, _res, next) {
  const provided = String(req.get('x-rider-sensitive-key') || '');
  if (provided && !riderKeyMatches(req)) return next(sensitiveKeyRejected());
  req.riderSensitiveAccess = riderKeyMatches(req);
  next();
}

function requireFranchiseRole(...allowedRoles) {
  return (req, _res, next) => {
    const requested = String(req.get('x-admin-role') || env.franchise.defaultAdminRole || 'owner')
      .trim()
      .toLowerCase();
    if (!FRANCHISE_ADMIN_ROLES.includes(requested)) {
      return next(new AppError('Invalid franchise admin role.', 403));
    }
    req.franchiseRole = requested;
    if (!allowedRoles.includes(requested)) {
      return next(new AppError('Your admin role cannot perform this action.', 403));
    }
    next();
  };
}

module.exports = {
  requireAdmin,
  requireRiderSensitiveAccess,
  optionalRiderSensitiveAccess,
  requireFranchiseRole,
};
