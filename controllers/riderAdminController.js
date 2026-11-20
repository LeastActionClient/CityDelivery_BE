const RiderApplication = require('../models/RiderApplication');
const RiderAuditLog = require('../models/RiderAuditLog');
const RiderSetting = require('../models/RiderSetting');
const AppError = require('../utils/AppError');
const { RIDER_STATUSES, RIDER_VEHICLE_TYPES } = require('../utils/constants');
const { generateRiderId } = require('../utils/generateRiderIds');
const { cleanText } = require('../utils/sanitize');
const { notifyRiderApplication, notifyRiderUpdate, riderUpdateDue } = require('../services/emailService');
const { env } = require('../config/env');
const {
  getRiderSettings,
  actorFromReq,
  audit,
  sanitizeAdminApplication,
  documentList,
} = require('../services/riderService');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function locateApplication(value) {
  const id = String(value || '').trim();
  if (/^[0-9a-fA-F]{24}$/.test(id)) return RiderApplication.findOne({ _id: id });
  return RiderApplication.findOne({ applicationId: id });
}

function paging(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function resetNotification(state) {
  state.status = 'pending';
  state.attempts = 0;
  state.sentAt = undefined;
  state.lastError = undefined;
}

exports.adminList = async (req, res, next) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const filter = {};

    if (req.query.status) {
      const status = String(req.query.status);
      if (!RIDER_STATUSES.includes(status)) throw new AppError('Invalid status filter.', 400);
      filter.applicationStatus = status;
    }
    if (req.query.area) filter['address.area'] = cleanText(req.query.area).slice(0, 120);
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;

    const q = cleanText(req.query.q).slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegExp(q), 'i');
      filter.$or = [
        { applicationId: rx },
        { riderId: rx },
        { 'personalInformation.fullName': rx },
        { 'contactInformation.mobile': rx },
        { 'address.area': rx },
      ];
    }

    const [items, total] = await Promise.all([
      RiderApplication.find(filter).setOptions({ sanitizeFilter: false }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RiderApplication.countDocuments(filter).setOptions({ sanitizeFilter: false }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((item) => sanitizeAdminApplication(item, { sensitive: false })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.adminGetRider = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);
    res.json({
      success: true,
      data: sanitizeAdminApplication(doc, { sensitive: Boolean(req.riderSensitiveAccess) }),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (!RIDER_STATUSES.includes(status)) {
      throw new AppError(`Status must be one of: ${RIDER_STATUSES.join(', ')}`, 422);
    }
    const actor = actorFromReq(req);
    const reason = cleanText(req.body.reason || req.body.message || '').slice(0, 1000);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);

    let notifyType = null;
    doc.applicationStatus = status;

    if (status === 'Approved') {
      if (!doc.riderId) doc.riderId = generateRiderId();
      doc.approvedAt = new Date();
      doc.approvedBy = actor;
      doc.rejectionReason = '';
      resetNotification(doc.notifications.approval);
      notifyType = 'approval';
    } else if (status === 'Rejected') {
      if (!reason) throw new AppError('A rejection reason is required.', 422, { reason: 'Please provide a reason.' });
      doc.rejectionReason = reason;
      doc.active = false;
      doc.deactivatedAt = new Date();
      resetNotification(doc.notifications.rejection);
      notifyType = 'rejection';
    } else if (status === 'Additional Documents Required') {
      if (!reason) throw new AppError('Please describe the documents required.', 422, { message: 'Please describe the documents required.' });
      doc.additionalDocumentRequest = { message: reason, requestedAt: new Date(), requestedBy: actor };
      resetNotification(doc.notifications.documentsRequested);
      notifyType = 'documentsRequested';
    } else if (status === 'Inactive') {
      doc.active = false;
      doc.deactivatedAt = new Date();
    }

    await doc.save();
    await audit(doc, `STATUS_${status.toUpperCase().replace(/[^A-Z]+/g, '_')}`, actor, {
      status,
      reason: reason || undefined,
      riderId: doc.riderId || undefined,
    });
    if (notifyType) await notifyRiderUpdate(doc, notifyType);

    res.json({
      success: true,
      message: 'Rider application status updated.',
      data: sanitizeAdminApplication(doc, { sensitive: Boolean(req.riderSensitiveAccess) }),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminRequestDocuments = async (req, res, next) => {
  try {
    const message = cleanText(req.body.message).slice(0, 1000);
    if (!message) throw new AppError('Please describe the documents required.', 422, { message: 'This field is required.' });
    const actor = actorFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);

    doc.applicationStatus = 'Additional Documents Required';
    doc.additionalDocumentRequest = { message, requestedAt: new Date(), requestedBy: actor };
    resetNotification(doc.notifications.documentsRequested);
    await doc.save();
    await audit(doc, 'DOCUMENTS_REQUESTED', actor, { message });
    await notifyRiderUpdate(doc, 'documentsRequested');

    res.json({
      success: true,
      message: 'Document request saved and applicant notified.',
      data: sanitizeAdminApplication(doc, { sensitive: Boolean(req.riderSensitiveAccess) }),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminSetActivation = async (req, res, next) => {
  try {
    const active = req.body.active === true || req.body.active === 'true';
    const actor = actorFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);

    if (active && doc.applicationStatus !== 'Approved') {
      throw new AppError('Only approved applications can be activated.', 422);
    }
    if (active && !doc.riderId) doc.riderId = generateRiderId();
    doc.active = active;
    if (active) {
      doc.activatedAt = new Date();
      doc.deactivatedAt = undefined;
      resetNotification(doc.notifications.activation);
    } else {
      doc.deactivatedAt = new Date();
    }
    await doc.save();
    await audit(doc, active ? 'RIDER_ACTIVATED' : 'RIDER_DEACTIVATED', actor, { riderId: doc.riderId });
    if (active) await notifyRiderUpdate(doc, 'activation');

    res.json({
      success: true,
      message: active ? 'Rider activated.' : 'Rider deactivated.',
      data: sanitizeAdminApplication(doc, { sensitive: Boolean(req.riderSensitiveAccess) }),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminDocuments = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);
    res.json({
      success: true,
      data: {
        applicationId: doc.applicationId,
        documents: documentList(doc, { sensitive: true }),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.adminAudit = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);
    const logs = await RiderAuditLog.find({ riderApplication: doc._id }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

exports.adminGetSettings = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getRiderSettings() });
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateSettings = async (req, res, next) => {
  try {
    const current = await getRiderSettings();
    const update = { updatedBy: actorFromReq(req) };

    if (req.body.allowedVehicleTypes !== undefined) {
      if (!Array.isArray(req.body.allowedVehicleTypes) || !req.body.allowedVehicleTypes.length) {
        throw new AppError('Please choose at least one vehicle type.', 422);
      }
      const types = [...new Set(req.body.allowedVehicleTypes.map(String))];
      if (types.some((type) => !RIDER_VEHICLE_TYPES.includes(type))) {
        throw new AppError('One or more vehicle types are invalid.', 422);
      }
      update.allowedVehicleTypes = types;
    }
    for (const key of ['requireInsurance', 'requireAadhaar']) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== 'boolean' && !['true', 'false'].includes(String(req.body[key]))) {
          throw new AppError(`${key} must be true or false.`, 422);
        }
        update[key] = req.body[key] === true || req.body[key] === 'true';
      }
    }

    const settings = await RiderSetting.findByIdAndUpdate(current._id, { $set: update }, { new: true }).lean();
    res.json({ success: true, message: 'Rider requirements updated.', data: settings });
  } catch (err) {
    next(err);
  }
};

exports.adminRetryNotifications = async (req, res, next) => {
  try {
    if (!env.smtpConfigured) throw new AppError('SMTP is not configured.', 503);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Rider application not found.', 404);
    const results = {};
    if (doc.notifications.submitted.status !== 'sent') results.submitted = await notifyRiderApplication(doc);
    for (const key of ['approval', 'rejection', 'documentsRequested', 'activation']) {
      if (riderUpdateDue(doc, key)) results[key] = await notifyRiderUpdate(doc, key);
    }
    res.json({ success: true, data: { applicationId: doc.applicationId, results } });
  } catch (err) {
    next(err);
  }
};
