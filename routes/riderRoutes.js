const express = require('express');
const { apiLimiter, riderSubmissionLimiter, riderStatusLimiter } = require('../middleware/rateLimit');
const { uploadRiderDocuments, expandRiderBody, verifyRiderDocuments } = require('../middleware/riderUpload');
const { riderRegistrationRules, riderStatusRules } = require('../middleware/rules');
const { validate, rejectMongoOperators } = require('../middleware/validate');
const controller = require('../controllers/riderController');

const router = express.Router();

router.get('/config', apiLimiter, controller.getRiderConfig);
router.post(
  '/register',
  apiLimiter,
  riderSubmissionLimiter,
  uploadRiderDocuments,
  expandRiderBody,
  rejectMongoOperators,
  verifyRiderDocuments,
  riderRegistrationRules,
  validate,
  controller.registerRider
);
router.post('/status', apiLimiter, riderStatusLimiter, riderStatusRules, validate, controller.getRiderStatus);

module.exports = router;
