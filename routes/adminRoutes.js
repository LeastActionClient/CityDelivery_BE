const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimit');
const { rejectMongoOperators } = require('../middleware/validate');
const ctrl = require('../controllers/requestController');

const router = express.Router();

router.use(adminLimiter, requireAdmin, rejectMongoOperators);

router.get('/requests', ctrl.adminList);
router.patch('/requests/:requestId/status', ctrl.adminUpdateStatus);
router.post('/requests/:requestId/retry-notifications', ctrl.adminRetryNotifications);

module.exports = router;
