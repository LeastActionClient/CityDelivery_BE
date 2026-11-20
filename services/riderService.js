const RiderApplication = require('../models/RiderApplication');
const RiderSetting = require('../models/RiderSetting');
const RiderAuditLog = require('../models/RiderAuditLog');
const { RIDER_PUBLIC_DOCUMENT_KEYS, RIDER_SENSITIVE_DOCUMENT_KEYS } = require('../utils/constants');
const { cleanText } = require('../utils/sanitize');
const { documentUrl } = require('./riderDocumentService');

async function getRiderSettings() {
  const settings = await RiderSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  ).lean();
  return settings;
}

function actorFromReq(req) {
  return cleanText(req.get('x-admin-actor') || 'admin').slice(0, 120) || 'admin';
}

async function audit(application, action, actor, details = {}) {
  return RiderAuditLog.create({
    applicationId: application.applicationId,
    riderApplication: application._id,
    action,
    actor,
    details,
  });
}

function dedupeKeyFor(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `mobile:${digits}:${date}`;
}

function requiredDocumentKeys(body, settings) {
  const keys = ['profilePhoto', 'licenceFront', 'licenceBack', 'panDocument'];
  const ownsVehicle = body.vehicleInformation?.ownsVehicle === true || body.vehicleInformation?.ownsVehicle === 'true';
  if (ownsVehicle) {
    keys.push('vehicleRcFront', 'vehicleRcBack', 'vehiclePhoto');
    if (body.vehicleInformation?.insuranceAvailable || settings.requireInsurance) keys.push('insuranceDocument');
  }
  if (body.identityVerification?.aadhaarNumber || settings.requireAadhaar) keys.push('aadhaarDocument');
  return [...new Set(keys)];
}

function normalizeApplicationData(body) {
  const b = body || {};
  const str = (value) => String(value ?? '').trim();
  return {
    personalInformation: {
      fullName: str(b.personalInformation?.fullName),
      dateOfBirth: new Date(b.personalInformation?.dateOfBirth),
      gender: str(b.personalInformation?.gender),
    },
    contactInformation: {
      mobile: str(b.contactInformation?.mobile),
      whatsapp: str(b.contactInformation?.whatsapp),
      email: str(b.contactInformation?.email).toLowerCase(),
      emergencyContactName: str(b.contactInformation?.emergencyContactName),
      emergencyContactNumber: str(b.contactInformation?.emergencyContactNumber),
    },
    address: {
      residentialAddress: str(b.address?.residentialAddress),
      city: str(b.address?.city) || 'Vellore',
      area: str(b.address?.area),
      pincode: str(b.address?.pincode),
    },
    drivingInformation: {
      licenceNumber: str(b.drivingInformation?.licenceNumber).toUpperCase(),
      experience: str(b.drivingInformation?.experience),
    },
    vehicleInformation: {
      ownsVehicle: b.vehicleInformation?.ownsVehicle === true || b.vehicleInformation?.ownsVehicle === 'true',
      assistanceRequired: b.vehicleInformation?.assistanceRequired === true || b.vehicleInformation?.assistanceRequired === 'true',
      vehicleType: str(b.vehicleInformation?.vehicleType),
      registrationNumber: str(b.vehicleInformation?.registrationNumber).toUpperCase(),
      brand: str(b.vehicleInformation?.brand),
      model: str(b.vehicleInformation?.model),
      insuranceAvailable: b.vehicleInformation?.insuranceAvailable === true || b.vehicleInformation?.insuranceAvailable === 'true',
    },
    workPreferences: {
      preferredWorkingArea: str(b.workPreferences?.preferredWorkingArea),
      workType: str(b.workPreferences?.workType),
      preferredWorkingHours: str(b.workPreferences?.preferredWorkingHours),
      availabilityDays: Array.isArray(b.workPreferences?.availabilityDays)
        ? b.workPreferences.availabilityDays.map(str).filter(Boolean)
        : [],
    },
    identityVerification: {
      aadhaarConsent: b.identityVerification?.aadhaarConsent === true || b.identityVerification?.aadhaarConsent === 'true',
      aadhaarNumber: str(b.identityVerification?.aadhaarNumber),
      panConsent: b.identityVerification?.panConsent === true || b.identityVerification?.panConsent === 'true',
      panNumber: str(b.identityVerification?.panNumber).toUpperCase(),
      additionalNotes: str(b.identityVerification?.additionalNotes),
    },
    paymentInformation: {
      submitted: b.paymentInformation?.submitted === true || b.paymentInformation?.submitted === 'true',
      accountHolderName: str(b.paymentInformation?.accountHolderName),
      bankName: str(b.paymentInformation?.bankName),
      accountNumber: str(b.paymentInformation?.accountNumber),
      ifscCode: str(b.paymentInformation?.ifscCode).toUpperCase(),
      upiId: str(b.paymentInformation?.upiId),
    },
  };
}

const STATUS_NEXT_STEPS = {
  Submitted: 'Your application has been received. Our team will review your documents.',
  'Under Review': 'Your application is being reviewed. No action is needed right now.',
  'Additional Documents Required': 'Please contact our team with the requested documents. Keep your Application ID handy.',
  Approved: 'Your application has been approved. Watch this page for your Rider ID and activation update.',
  Rejected: 'This application was not approved. You may contact us for clarification.',
  Inactive: 'This rider account is currently inactive.',
};

function sanitizePublicApplication(doc) {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    applicationId: d.applicationId,
    applicationStatus: d.applicationStatus,
    riderId: d.riderId || null,
    active: Boolean(d.active),
    submittedAt: d.createdAt,
    updatedAt: d.updatedAt,
    approvedAt: d.approvedAt || null,
    riderName: d.personalInformation?.fullName || null,
    vehicleType: d.vehicleInformation?.vehicleType || null,
    workingArea: d.workPreferences?.preferredWorkingArea || null,
    rejectionReason: d.applicationStatus === 'Rejected' ? d.rejectionReason || '' : '',
    documentRequestMessage: d.applicationStatus === 'Additional Documents Required' ? d.additionalDocumentRequest?.message || '' : '',
    nextSteps: d.active
      ? 'Your rider account is active. Delivery assignment tools will be available through the dedicated rider app when enabled.'
      : STATUS_NEXT_STEPS[d.applicationStatus] || '',
  };
}

function documentRecords(doc) {
  const raw = doc?.uploadedDocuments || {};
  return raw instanceof Map ? Object.fromEntries(raw) : raw;
}

function sanitizeAdminApplication(doc, { sensitive = false } = {}) {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  d.uploadedDocuments = documentRecords(d);
  if (!sensitive) {
    if (d.identityVerification) {
      delete d.identityVerification.aadhaarNumber;
      delete d.identityVerification.panNumber;
    }
    delete d.paymentInformation;
    if (d.uploadedDocuments) {
      for (const key of RIDER_SENSITIVE_DOCUMENT_KEYS) delete d.uploadedDocuments[key];
    }
  }
  return {
    ...d,
    sensitiveDataUnlocked: Boolean(sensitive),
    documents: documentList(d, { sensitive }),
  };
}

function documentList(doc, { sensitive = false } = {}) {
  const records = documentRecords(doc);
  const keys = sensitive
    ? [...RIDER_PUBLIC_DOCUMENT_KEYS, ...RIDER_SENSITIVE_DOCUMENT_KEYS]
    : RIDER_PUBLIC_DOCUMENT_KEYS;
  return keys
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

module.exports = {
  getRiderSettings,
  actorFromReq,
  audit,
  dedupeKeyFor,
  requiredDocumentKeys,
  normalizeApplicationData,
  sanitizePublicApplication,
  sanitizeAdminApplication,
  documentList,
};
