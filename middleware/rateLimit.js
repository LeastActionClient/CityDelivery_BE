const rateLimit = require('express-rate-limit');

const json429 = (message) => (_req, res) => res.status(429).json({ success: false, message });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many requests. Please try again in a few minutes.'),
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('You have submitted several requests recently. Please try again later.'),
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many requests.'),
});

module.exports = { apiLimiter, submissionLimiter, adminLimiter };
