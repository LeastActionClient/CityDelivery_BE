const FranchiseApplication = require('../models/FranchiseApplication');
const FranchiseAuditLog = require('../models/FranchiseAuditLog');
const FranchiseSetting = require('../models/FranchiseSetting');
const AppError = require('../utils/AppError');
const { FRANCHISE_STATUSES } = require('../utils/constants');
const { cleanText } = require('../utils/sanitize');
const { generateFranchiseId } = require('../utils/generateFranchiseIds');
const { env } = require('../config/env');
const {
  notifyFranchiseApplication,
  notifyFranchiseUpdate,
  franchiseUpdateDue,
} = require('../services/emailService');
const {
  getFranchiseSettings,
  actorFromReq,
  roleFromReq,
  audit,
  sanitizeAdminApplication,
  documentList,
  resetNotification,
} = require('../services/franchiseService');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function locateApplication(value) {
  const id = String(value || '').trim();
  if (/^[0-9a-fA-F]{24}$/.test(id)) return FranchiseApplication.findOne({ _id: id });
  return FranchiseApplication.findOne({ applicationId: id });
}

function paging(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

exports.adminList = async (req, res, next) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const filter = {};

    if (req.query.status) {
      const status = String(req.query.status);
      if (!FRANCHISE_STATUSES.includes(status)) throw new AppError('Invalid status filter.', 400);
      filter.applicationStatus = status;
    }
    if (req.query.city) filter['location.city'] = cleanText(req.query.city).slice(0, 80);
    if (req.query.payment === 'paid') filter['payment.status'] = 'PAID';
    if (req.query.payment === 'pending') filter['payment.status'] = { $in: ['PENDING', 'FAILED'] };

    const q = cleanText(req.query.q).slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegExp(q), 'i');
      filter.$or = [
        { applicationId: rx },
        { franchiseId: rx },
        { fullName: rx },
        { mobile: rx },
        { email: rx },
        { 'location.city': rx },
        { 'location.preferredOperatingArea': rx },
        { 'payment.orderId': rx },
        { 'payment.transactionId': rx },
      ];
    }

    const [items, total] = await Promise.all([
      FranchiseApplication.find(filter).setOptions({ sanitizeFilter: false }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FranchiseApplication.countDocuments(filter).setOptions({ sanitizeFilter: false }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map(sanitizeAdminApplication),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.adminGetApplication = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);
    res.json({ success: true, data: sanitizeAdminApplication(doc) });
  } catch (err) {
    next(err);
  }
};

const NOTIFY_KEY_BY_STATUS = {
  'Payment Successful': 'paymentSuccess',
  'Under Review': 'underReview',
  Approved: 'approved',
  Rejected: 'rejected',
  'Agreement Pending': 'agreementPending',
  'Active Franchise': 'activated',
};

exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (!FRANCHISE_STATUSES.includes(status)) {
      throw new AppError(`Status must be one of: ${FRANCHISE_STATUSES.join(', ')}`, 422);
    }
    const reason = cleanText(req.body.reason || '').slice(0, 1000);
    const actor = actorFromReq(req);
    const role = roleFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);

    if (status === 'Rejected' && !reason) {
      throw new AppError('A rejection reason is required.', 422, { reason: 'Please provide a reason.' });
    }
    if (status === 'Active Franchise' && !['Approved', 'Agreement Pending'].includes(doc.applicationStatus)) {
      throw new AppError('Only approved applications can be activated.', 422);
    }

    doc.applicationStatus = status;
    let notifyKey = NOTIFY_KEY_BY_STATUS[status] || null;

    if (status === 'Approved') {
      doc.approvedAt = new Date();
      doc.approvedBy = actor;
      doc.rejectionReason = '';
    } else if (status === 'Rejected') {
      doc.rejectionReason = reason;
    } else if (status === 'Active Franchise') {
      if (!doc.franchiseId) doc.franchiseId = generateFranchiseId();
      doc.activatedAt = new Date();
    }

    if (notifyKey) resetNotification(doc.notifications[notifyKey]);
    if (status !== 'Rejected') doc.infoRequest = { message: '', requestedAt: undefined, requestedBy: '' };

    await doc.save();
    await audit(doc, `STATUS_${status.toUpperCase().replace(/[^A-Z]+/g, '_')}`, actor, {
      status,
      reason: reason || undefined,
      franchiseId: doc.franchiseId || undefined,
    }, role);
    if (notifyKey) await notifyFranchiseUpdate(doc, notifyKey);

    res.json({
      success: true,
      message: 'Franchise application status updated.',
      data: sanitizeAdminApplication(doc),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminMarkFeePaid = async (req, res, next) => {
  try {
    const reference = cleanText(req.body.reference).slice(0, 120);
    const note = cleanText(req.body.note).slice(0, 500);
    const actor = actorFromReq(req);
    const role = roleFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);
    if (doc.payment.status === 'PAID') throw new AppError('Initial payment is already recorded as paid.', 422);
    if (doc.payment.status === 'REFUNDED') throw new AppError('A refunded payment cannot be marked as paid.', 422);

    const paidAt = new Date();
    doc.payment.status = 'PAID';
    doc.payment.provider = 'OFFLINE';
    doc.payment.orderStatus = 'PAID';
    doc.payment.amount = doc.feeSnapshot?.amount || doc.payment.amount || 1000;
    doc.payment.currency = doc.feeSnapshot?.currency || doc.payment.currency || 'INR';
    doc.payment.transactionId = reference;
    doc.payment.paymentMethod = 'Offline (admin)';
    doc.payment.paidAt = paidAt;
    doc.payment.lastError = '';
    doc.payment.events.push({
      eventId: `offline-${paidAt.getTime()}-${doc.applicationId}`,
      type: 'ADMIN_MARK_PAID',
      receivedAt: paidAt,
      orderStatus: 'PAID',
      message: note || 'Initial payment marked as paid by admin.',
    });
    if (doc.applicationStatus === 'Payment Pending') doc.applicationStatus = 'Payment Successful';
    resetNotification(doc.notifications.paymentSuccess);
    await doc.save();
    await audit(doc, 'PAYMENT_MARKED_PAID', actor, {
      reference: reference || undefined,
      note: note || undefined,
      amount: doc.payment.amount,
    }, role);
    await notifyFranchiseUpdate(doc, 'paymentSuccess');

    res.json({
      success: true,
      message: 'Initial payment marked as paid.',
      data: sanitizeAdminApplication(doc),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminRequestInfo = async (req, res, next) => {
  try {
    const message = cleanText(req.body.message).slice(0, 1000);
    if (!message) throw new AppError('Please describe the information required.', 422, { message: 'This field is required.' });
    const actor = actorFromReq(req);
    const role = roleFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);

    doc.infoRequest = { message, requestedAt: new Date(), requestedBy: actor };
    resetNotification(doc.notifications.additionalInfoRequested);
    await doc.save();
    await audit(doc, 'INFO_REQUESTED', actor, { message }, role);
    await notifyFranchiseUpdate(doc, 'additionalInfoRequested');

    res.json({
      success: true,
      message: 'Information request saved and applicant notified.',
      data: sanitizeAdminApplication(doc),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminAddNote = async (req, res, next) => {
  try {
    const text = cleanText(req.body.text).slice(0, 1000);
    if (!text) throw new AppError('Please enter a note.', 422, { text: 'This field is required.' });
    const actor = actorFromReq(req);
    const role = roleFromReq(req);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);

    doc.adminNotes.push({ text, actor, role, createdAt: new Date() });
    doc.adminRemarks = text;
    await doc.save();
    await audit(doc, 'NOTE_ADDED', actor, { text }, role);

    res.json({
      success: true,
      message: 'Internal note added.',
      data: sanitizeAdminApplication(doc),
    });
  } catch (err) {
    next(err);
  }
};

exports.adminDocuments = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);
    res.json({
      success: true,
      data: {
        applicationId: doc.applicationId,
        documents: documentList(doc),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.adminAudit = async (req, res, next) => {
  try {
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);
    const logs = await FranchiseAuditLog.find({ franchiseApplication: doc._id }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

exports.adminGetSettings = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getFranchiseSettings() });
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateSettings = async (req, res, next) => {
  try {
    const current = await getFranchiseSettings();
    const update = { updatedBy: actorFromReq(req) };
    if (req.body.applicationFee !== undefined) {
      const fee = Number(req.body.applicationFee);
      if (!Number.isFinite(fee) || fee < 1 || fee > 100000) {
        throw new AppError('Initial payment must be between ₹1 and ₹1,00,000.', 422);
      }
      update.applicationFee = Math.round(fee * 100) / 100;
    }
    if (req.body.refundPolicy !== undefined) {
      const policy = String(req.body.refundPolicy);
      if (!['Refundable', 'Non-refundable'].includes(policy)) {
        throw new AppError('Please choose a valid refund policy.', 422);
      }
      update.refundPolicy = policy;
    }
    if (req.body.refundPolicyDetails !== undefined) {
      update.refundPolicyDetails = cleanText(req.body.refundPolicyDetails).slice(0, 1000);
    }
    if (req.body.paymentInstructions !== undefined) {
      update.paymentInstructions = cleanText(req.body.paymentInstructions).slice(0, 1000);
    }

    const settings = await FranchiseSetting.findByIdAndUpdate(
      current._id,
      { $set: update },
      { new: true }
    ).lean();
    await audit(
      { applicationId: 'SETTINGS', _id: current._id },
      'SETTINGS_UPDATED',
      actorFromReq(req),
      update,
      roleFromReq(req)
    );
    res.json({ success: true, message: 'Franchise fee and policy updated.', data: settings });
  } catch (err) {
    next(err);
  }
};

exports.adminRetryNotifications = async (req, res, next) => {
  try {
    if (!env.smtpConfigured) throw new AppError('SMTP is not configured.', 503);
    const doc = await locateApplication(req.params.id);
    if (!doc) throw new AppError('Franchise application not found.', 404);
    const results = {};
    if (doc.notifications.submitted.status !== 'sent') {
      results.submitted = await notifyFranchiseApplication(doc);
    }
    for (const key of ['paymentSuccess', 'underReview', 'approved', 'rejected', 'additionalInfoRequested', 'agreementPending', 'activated']) {
      if (franchiseUpdateDue(doc, key)) results[key] = await notifyFranchiseUpdate(doc, key);
    }
    res.json({ success: true, data: { applicationId: doc.applicationId, results } });
  } catch (err) {
    next(err);
  }
};
