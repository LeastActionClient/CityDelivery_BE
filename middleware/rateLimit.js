const rateLimit = require('express-rate-limit');

const json429 = (message) => (_req, res) => res.status(429).json({ success: false, message });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
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
  limit: 500,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many admin requests. Please wait a few minutes.'),
});

const riderSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('You have submitted several rider applications recently. Please try again later.'),
});

const riderStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many status checks. Please try again in a few minutes.'),
});

const franchiseSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('You have submitted several franchise applications recently. Please try again later.'),
});

const franchiseStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many status checks. Please try again in a few minutes.'),
});

module.exports = {
  apiLimiter,
  submissionLimiter,
  adminLimiter,
  riderSubmissionLimiter,
  riderStatusLimiter,
  franchiseSubmissionLimiter,
  franchiseStatusLimiter,
};
