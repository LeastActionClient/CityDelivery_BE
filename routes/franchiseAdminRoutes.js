const express = require('express');
const { requireAdmin, requireFranchiseRole } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimit');
const { validate, rejectMongoOperators } = require('../middleware/validate');
const {
  franchiseAdminStatusRules,
  franchiseInfoRules,
  franchiseNoteRules,
  franchiseMarkPaidRules,
  franchiseSettingsRules,
} = require('../middleware/rules');
const controller = require('../controllers/franchiseAdminController');

const router = express.Router();
const ALL_ROLES = ['owner', 'franchise_manager', 'support'];
const WRITE_ROLES = ['owner', 'franchise_manager'];

router.use(requireAdmin);
router.use(adminLimiter);

router.get('/franchises/settings', requireFranchiseRole(...ALL_ROLES), controller.adminGetSettings);
router.patch(
  '/franchises/settings',
  requireFranchiseRole(...WRITE_ROLES),
  rejectMongoOperators,
  franchiseSettingsRules,
  validate,
  controller.adminUpdateSettings
);

router.get('/franchises', requireFranchiseRole(...ALL_ROLES), controller.adminList);
router.get('/franchises/:id', requireFranchiseRole(...ALL_ROLES), controller.adminGetApplication);
router.patch(
  '/franchises/:id/status',
  requireFranchiseRole(...WRITE_ROLES),
  rejectMongoOperators,
  franchiseAdminStatusRules,
  validate,
  controller.adminUpdateStatus
);
router.patch(
  '/franchises/:id/mark-paid',
  requireFranchiseRole(...WRITE_ROLES),
  rejectMongoOperators,
  franchiseMarkPaidRules,
  validate,
  controller.adminMarkFeePaid
);
router.patch(
  '/franchises/:id/request-info',
  requireFranchiseRole(...ALL_ROLES),
  rejectMongoOperators,
  franchiseInfoRules,
  validate,
  controller.adminRequestInfo
);
router.post(
  '/franchises/:id/notes',
  requireFranchiseRole(...WRITE_ROLES),
  rejectMongoOperators,
  franchiseNoteRules,
  validate,
  controller.adminAddNote
);
router.get('/franchises/:id/documents', requireFranchiseRole(...ALL_ROLES), controller.adminDocuments);
router.get('/franchises/:id/audit', requireFranchiseRole(...ALL_ROLES), controller.adminAudit);
router.post('/franchises/:id/retry-notifications', requireFranchiseRole(...ALL_ROLES), controller.adminRetryNotifications);

module.exports = router;
