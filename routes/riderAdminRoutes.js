const express = require('express');
const { requireAdmin, requireRiderSensitiveAccess, optionalRiderSensitiveAccess } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimit');
const controller = require('../controllers/riderAdminController');

const router = express.Router();

router.use(requireAdmin);
router.use(adminLimiter);

router.get('/riders/settings', controller.adminGetSettings);
router.patch('/riders/settings', controller.adminUpdateSettings);

router.get('/riders', controller.adminList);
router.get('/riders/:id', optionalRiderSensitiveAccess, controller.adminGetRider);
router.patch('/riders/:id/status', optionalRiderSensitiveAccess, controller.adminUpdateStatus);
router.patch('/riders/:id/request-documents', optionalRiderSensitiveAccess, controller.adminRequestDocuments);
router.patch('/riders/:id/activation', optionalRiderSensitiveAccess, controller.adminSetActivation);
router.get('/riders/:id/documents', requireRiderSensitiveAccess, controller.adminDocuments);
router.get('/riders/:id/audit', optionalRiderSensitiveAccess, controller.adminAudit);
router.post('/riders/:id/retry-notifications', optionalRiderSensitiveAccess, controller.adminRetryNotifications);

module.exports = router;
