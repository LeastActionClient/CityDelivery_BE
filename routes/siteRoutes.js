const express = require('express');
const controller = require('../controllers/siteController');

const router = express.Router();

router.get('/config', controller.getSiteConfig);

module.exports = router;
