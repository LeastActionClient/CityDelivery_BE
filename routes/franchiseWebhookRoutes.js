const express = require('express');
const controller = require('../controllers/franchiseController');

const router = express.Router();

router.post('/', controller.handleWebhook);

module.exports = router;
