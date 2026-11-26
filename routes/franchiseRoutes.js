const express = require('express');
const { apiLimiter, franchiseSubmissionLimiter, franchiseStatusLimiter } = require('../middleware/rateLimit');
const { uploadFranchiseDocuments, expandFranchiseBody, verifyFranchiseDocuments } = require('../middleware/franchiseUpload');
const { franchiseRegistrationRules, franchiseStatusRules } = require('../middleware/rules');
const { validate, rejectMongoOperators } = require('../middleware/validate');
const controller = require('../controllers/franchiseController');

const router = express.Router();

router.get('/config', apiLimiter, controller.getFranchiseConfig);
router.post(
  '/register',
  apiLimiter,
  franchiseSubmissionLimiter,
  uploadFranchiseDocuments,
  expandFranchiseBody,
  verifyFranchiseDocuments,
  rejectMongoOperators,
  franchiseRegistrationRules,
  validate,
  controller.registerFranchise
);
router.post('/status', apiLimiter, franchiseStatusLimiter, franchiseStatusRules, validate, controller.getFranchiseStatus);

module.exports = router;
