const express = require('express');
const { upload, verifyImage } = require('../middleware/upload');
const { validate, rejectMongoOperators } = require('../middleware/validate');
const { productRequestRules } = require('../middleware/rules');
const { submissionLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/requestController');

const router = express.Router();

// multer first (multipart parsing) -> operator check -> signature check -> validation -> handler
router.post(
  '/',
  submissionLimiter,
  upload,
  rejectMongoOperators,
  verifyImage,
  productRequestRules,
  validate,
  ctrl.createRequest
);

router.get('/:requestId/status', ctrl.getRequestStatus);

module.exports = router;
