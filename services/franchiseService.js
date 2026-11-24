const FranchiseApplication = require('../models/FranchiseApplication');
const FranchiseSetting = require('../models/FranchiseSetting');
const FranchiseAuditLog = require('../models/FranchiseAuditLog');
const {
  FRANCHISE_DOCUMENT_KEYS,
  FRANCHISE_VEHICLE_TYPES,
} = require('../utils/constants');
const { cleanText } = require('../utils/sanitize');
const { documentUrl } = require('./franchiseDocumentService');

async function getFranchiseSettings() {
  return FranchiseSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  ).lean();
}

function actorFromReq(req) {
  return cleanText(req.get('x-admin-actor') || 'admin').slice(0, 120) || 'admin';
}

function roleFromReq(req) {
  return req.franchiseRole || 'owner';
}

async function audit(application, action, actor, details = {}, role = '') {
  return FranchiseAuditLog.create({
    applicationId: application.applicationId,
    franchiseApplication: application._id,
    action,
    actor,
    role,
    details,
  });
}

function dedupeKeyFor(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `mobile:${digits}:${date}`;
}

function parseBooleanLike(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function normalizeVehicles(value) {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.keys(value).sort((a, b) => Number(a) - Number(b)).map((key) => value[key])
      : [];
  return rows
    .map((row) => {
      const item = row && typeof row === 'object' ? row : {};
      const type = cleanText(item.type);
      const count = Number(item.count);
      if (!FRANCHISE_VEHICLE_TYPES.includes(type) || !Number.isInteger(count) || count <= 0) return null;
      return {
        type,
        otherType: type === 'Other' ? cleanText(item.otherType).slice(0, 80) : '',
        count: Math.min(count, 1000),
      };
    })
    .filter(Boolean)
    .slice(0, FRANCHISE_VEHICLE_TYPES.length);
}

function normalizeApplicationData(body, settings) {
  const b = body || {};
  const str = (value) => String(value ?? '').trim();
  const vehicles = normalizeVehicles(b.vehicles);
  const vehicleCount = vehicles.reduce((sum, item) => sum + item.count, 0);
  return {
    fullName: str(b.fullName),
    mobile: str(b.mobile),
    email: str(b.email).toLowerCase(),
    location: {
      state: str(b.state),
      district: str(b.district),
      city: str(b.city),
      preferredOperatingArea: str(b.preferredOperatingArea),
      pincode: str(b.pincode),
      fullAddress: str(b.fullAddress),
    },
    business: {
      experience: str(b.businessExperience),
      investmentCapacity: str(b.investmentCapacity),
      hasOfficeOrShop: parseBooleanLike(b.hasOfficeOrShop),
      numberOfVehicles: vehicleCount || Number(b.numberOfVehicles) || 0,
      vehicles,
      motivation: str(b.motivation),
    },
    feeSnapshot: {
      amount: Number(settings.applicationFee) || 1000,
      currency: settings.currency || 'INR',
      refundPolicy: settings.refundPolicy || 'Non-refundable',
      refundPolicyDetails: str(settings.refundPolicyDetails),
    },
  };
}

const STATUS_NEXT_STEPS = {
  'Payment Pending': 'Initial payment is optional. You can pay from the status page, or our team will continue reviewing your application.',
  'Payment Successful': 'Initial payment received. Our team will continue reviewing your application and contact you if anything else is needed.',
  'Under Review': 'Your application is being reviewed. Initial payment is optional; no action is needed right now.',
  Approved: 'Your application has been approved. Our team will contact you with agreement and onboarding details.',
  Rejected: 'This application was not approved. You may contact us for clarification.',
  'Agreement Pending': 'Your application is approved. Agreement and onboarding steps are being prepared.',
  'Active Franchise': 'Your franchise is active. Our team will contact you with operating details.',
};

function documentRecords(doc) {
  const raw = doc?.uploadedDocuments || {};
  return raw instanceof Map ? Object.fromEntries(raw) : raw;
}

function sanitizePublicApplication(doc) {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    applicationId: d.applicationId,
    applicationStatus: d.applicationStatus,
    fullName: d.fullName || null,
    city: d.location?.city || null,
    area: d.location?.preferredOperatingArea || null,
    submittedAt: d.createdAt,
    updatedAt: d.updatedAt,
    fee: d.feeSnapshot || null,
    payment: d.payment
      ? {
          status: d.payment.status,
          amount: d.payment.amount || d.feeSnapshot?.amount || 0,
          currency: d.payment.currency || 'INR',
          paidAt: d.payment.paidAt || null,
          transactionId: d.payment.transactionId || null,
          orderId: d.payment.transactionId ? d.payment.orderId : null,
          lastError: d.payment.status === 'FAILED' ? d.payment.lastError || '' : '',
        }
      : null,
    franchiseId: d.franchiseId || null,
    rejectionReason: d.applicationStatus === 'Rejected' ? d.rejectionReason || '' : '',
    infoRequestMessage: d.applicationStatus === 'Additional Information Required' ? d.infoRequest?.message || '' : d.infoRequest?.message || '',
    nextSteps: STATUS_NEXT_STEPS[d.applicationStatus] || '',
  };
}

function documentList(doc) {
  const records = documentRecords(doc);
  return FRANCHISE_DOCUMENT_KEYS
    .filter((key) => records[key])
    .map((key) => ({
      key,
      originalName: records[key].originalName,
      mimeType: records[key].mimeType,
      format: records[key].format,
      bytes: records[key].bytes,
      uploadedAt: records[key].uploadedAt,
      url: documentUrl(records[key], { attachment: true, seconds: 600 }),
    }));
}

function sanitizeAdminApplication(doc) {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...d,
    documents: documentList(d),
  };
}

function resetNotification(state) {
  state.status = 'pending';
  state.attempts = 0;
  state.sentAt = undefined;
  state.lastError = undefined;
}

function appendPaymentEvent(doc, { eventId = '', type = '', orderStatus = '', message = '' } = {}) {
  if (!doc.payment.events) doc.payment.events = [];
  if (eventId && doc.payment.events.some((event) => event.eventId === eventId)) return false;
  doc.payment.events.push({
    eventId: String(eventId).slice(0, 200),
    type: String(type).slice(0, 120),
    orderStatus: String(orderStatus).slice(0, 40),
    message: String(message).slice(0, 500),
    receivedAt: new Date(),
  });
  if (doc.payment.events.length > 30) doc.payment.events = doc.payment.events.slice(-30);
  return true;
}

function applyPaymentUpdate(doc, update) {
  const isPaid = update.status === 'PAID';
  doc.payment.status = isPaid ? 'PAID' : update.status === 'FAILED' ? 'FAILED' : doc.payment.status;
  if (update.orderId) doc.payment.orderId = update.orderId;
  if (update.sessionId) doc.payment.paymentSessionId = update.sessionId;
  if (update.amount) doc.payment.amount = Number(update.amount);
  if (update.currency) doc.payment.currency = update.currency;
  if (update.cfOrderId) doc.payment.cfOrderId = update.cfOrderId;
  if (update.orderStatus) doc.payment.orderStatus = update.orderStatus;
  if (update.transactionId) doc.payment.transactionId = update.transactionId;
  if (update.paymentMethod) doc.payment.paymentMethod = update.paymentMethod;
  if (update.lastError !== undefined) doc.payment.lastError = String(update.lastError).slice(0, 500);

  let becamePaid = false;
  if (isPaid) {
    if (!doc.payment.paidAt) doc.payment.paidAt = update.paidAt ? new Date(update.paidAt) : new Date();
    if (doc.applicationStatus === 'Payment Pending') {
      doc.applicationStatus = 'Payment Successful';
      becamePaid = true;
    }
    doc.payment.lastError = '';
  }
  const newEvent = appendPaymentEvent(doc, update);
  return { becamePaid, newEvent };
}

module.exports = {
  getFranchiseSettings,
  actorFromReq,
  roleFromReq,
  audit,
  dedupeKeyFor,
  normalizeVehicles,
  normalizeApplicationData,
  sanitizePublicApplication,
  sanitizeAdminApplication,
  documentRecords,
  documentList,
  resetNotification,
  appendPaymentEvent,
  applyPaymentUpdate,
};
