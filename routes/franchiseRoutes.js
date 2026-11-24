const express = require('express');
const {
  apiLimiter,
  franchiseSubmissionLimiter,
  franchiseStatusLimiter,
  franchisePaymentLimiter,
} = require('../middleware/rateLimit');
const { uploadFranchiseDocuments, expandFranchiseBody, verifyFranchiseDocuments } = require('../middleware/franchiseUpload');
const {
  franchiseRegistrationRules,
  franchiseStatusRules,
  franchisePaymentRules,
} = require('../middleware/rules');
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
router.post('/payment/order', apiLimiter, franchisePaymentLimiter, rejectMongoOperators, franchisePaymentRules, validate, controller.createPaymentOrder);
router.post('/payment/verify', apiLimiter, franchisePaymentLimiter, rejectMongoOperators, franchisePaymentRules, validate, controller.verifyPayment);

module.exports = router;
