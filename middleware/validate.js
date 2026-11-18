const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { hasMongoOperators } = require('../utils/sanitize');

/** Rejects NoSQL-operator payloads before they reach any query/model. */
function rejectMongoOperators(req, _res, next) {
  if (hasMongoOperators(req.body) || hasMongoOperators(req.query) || hasMongoOperators(req.params)) {
    return next(new AppError('Invalid characters in request.', 400));
  }
  next();
}

/** Collapses express-validator errors into { field: message }. */
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = {};
  for (const e of result.array({ onlyFirstError: true })) {
    if (!details[e.path]) details[e.path] = e.msg;
  }
  next(new AppError('Please fix the highlighted fields.', 422, details));
}

module.exports = { validate, rejectMongoOperators };
