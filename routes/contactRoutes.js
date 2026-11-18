const express = require('express');
const { validate, rejectMongoOperators } = require('../middleware/validate');
const { contactRules } = require('../middleware/rules');
const { submissionLimiter } = require('../middleware/rateLimit');
const { createContact } = require('../controllers/contactController');

const router = express.Router();

router.post('/', submissionLimiter, rejectMongoOperators, contactRules, validate, createContact);

module.exports = router;
