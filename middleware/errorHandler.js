const multer = require('multer');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 422;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'That image is too large. Please upload an image under 5 MB.';
      details = { productImage: 'Image must be 5 MB or smaller.' };
    } else {
      message = 'The upload was rejected. Please check your files and try again.';
    }
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed request body.';
  } else if (err.name === 'CastError' || err.name === 'ValidationError') {
    status = 422;
    message = 'Some of the submitted information is invalid.';
    if (err.name === 'ValidationError') {
      details = Object.fromEntries(
        Object.entries(err.errors || {}).map(([field, issue]) => [field, issue.message])
      );
    }
  } else if (err.message === 'Not allowed by CORS') {
    status = 403;
  } else if (!err.isOperational) {
    console.error('[error]', err);
    status = 500;
    message = 'Something went wrong on our side. Please try again shortly.';
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  if (!env.isProd && status === 500) body.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
