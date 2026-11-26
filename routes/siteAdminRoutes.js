const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimit');
const controller = require('../controllers/siteAdminController');

const router = express.Router();

router.use(requireAdmin);
router.use(adminLimiter);

router.get('/site/settings', controller.adminGetSettings);
router.patch('/site/settings', controller.adminUpdateSettings);

module.exports = router;
