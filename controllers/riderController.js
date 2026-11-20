const RiderApplication = require('../models/RiderApplication');
const AppError = require('../utils/AppError');
const { generateRiderApplicationId } = require('../utils/generateRiderIds');
const {
  RIDER_WORK_TYPES,
  RIDER_AVAILABILITY_DAYS,
  RIDER_DOCUMENT_KEYS,
} = require('../utils/constants');
const { uploadDocument, deleteDocument } = require('../services/riderDocumentService');
const { notifyRiderApplication } = require('../services/emailService');
const { env } = require('../config/env');
const {
  getRiderSettings,
  actorFromReq,
  audit,
  dedupeKeyFor,
  requiredDocumentKeys,
  normalizeApplicationData,
  sanitizePublicApplication,
} = require('../services/riderService');

const DOCUMENT_ERRORS = {
  profilePhoto: 'A recent profile photo is required.',
  licenceFront: 'Front side of your driving licence is required.',
  licenceBack: 'Back side of your driving licence is required.',
  vehicleRcFront: 'Front side of the vehicle RC is required.',
  vehicleRcBack: 'Back side of the vehicle RC is required.',
  vehiclePhoto: 'A photo of your vehicle is required.',
  insuranceDocument: 'Vehicle insurance proof is required.',
  aadhaarDocument: 'Aadhaar proof is required.',
  panDocument: 'PAN proof is required.',
};

function collectFiles(req, requiredKeys) {
  const files = req.files || [];
  const details = {};
  const grouped = {};

  for (const file of files) {
    if (!RIDER_DOCUMENT_KEYS.includes(file.fieldname)) continue;
    if (grouped[file.fieldname]) {
      details[file.fieldname] = 'Please upload only one file for this document.';
      continue;
    }
    grouped[file.fieldname] = file;
  }

  for (const key of requiredKeys) {
    if (!grouped[key]) details[key] = DOCUMENT_ERRORS[key] || 'This document is required.';
  }

  if (Object.keys(details).length) {
    throw new AppError('Please check the highlighted documents.', 422, details);
  }
  return grouped;
}

async function uploadAll(files, applicationId) {
  const uploaded = {};
  try {
    let index = 0;
    for (const [field, file] of Object.entries(files)) {
      const record = await uploadDocument(file.buffer, {
        applicationId,
        field,
        index,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      uploaded[field] = record;
      index += 1;
    }
    return uploaded;
  } catch (err) {
    await Promise.all(Object.values(uploaded).map((record) => deleteDocument(record)));
    throw err;
  }
}

async function createApplication(applicationId, payload) {
  try {
    return await RiderApplication.create({ applicationId, ...payload });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const existing = await RiderApplication.findOne({ submissionKey: payload.submissionKey });
    if (existing) return { existing };
    throw new AppError('Could not generate a unique application ID.', 409);
  }
}

exports.getRiderConfig = async (_req, res, next) => {
  try {
    const settings = await getRiderSettings();
    res.json({
      success: true,
      data: {
        serviceArea: 'Vellore',
        workTypes: RIDER_WORK_TYPES,
        availabilityDays: RIDER_AVAILABILITY_DAYS,
        allowedVehicleTypes: settings.allowedVehicleTypes,
        requirements: {
          requireInsurance: settings.requireInsurance,
          requireAadhaar: settings.requireAadhaar,
        },
        documents: {
          always: ['profilePhoto', 'licenceFront', 'licenceBack', 'panDocument'],
          ifOwnVehicle: ['vehicleRcFront', 'vehicleRcBack', 'vehiclePhoto'],
          conditional: ['insuranceDocument', 'aadhaarDocument'],
          optional: ['cancelledCheque', 'additionalDocument1', 'additionalDocument2'],
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.registerRider = async (req, res, next) => {
  let uploaded = {};
  let applicationId = null;
  try {
    if (req.body.website) {
      return res.status(201).json({
        success: true,
        message: 'Your rider application has been received.',
        data: { applicationId: 'RIDER-RECEIVED', applicationStatus: 'Submitted', duplicate: false },
      });
    }

    const settings = await getRiderSettings();
    const data = normalizeApplicationData(req.body);

    if (!settings.allowedVehicleTypes.includes(data.vehicleInformation.vehicleType)) {
      throw new AppError('Please choose an available vehicle type.', 422, {
        'vehicleInformation.vehicleType': 'This vehicle type is not currently available.',
      });
    }
    if (data.vehicleInformation.ownsVehicle && !data.vehicleInformation.vehicleType) {
      throw new AppError('Please choose your vehicle type.', 422, {
        'vehicleInformation.vehicleType': 'Vehicle type is required when you own a vehicle.',
      });
    }
    if (!data.vehicleInformation.ownsVehicle && !data.vehicleInformation.assistanceRequired) {
      throw new AppError('Please confirm if you need vehicle assistance.', 422, {
        'vehicleInformation.assistanceRequired': 'Please confirm this field.',
      });
    }

    const submissionKey = dedupeKeyFor(data.contactInformation.mobile);
    const existing = await RiderApplication.findOne({ submissionKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'We already have this application. No duplicate was created.',
        data: { ...sanitizePublicApplication(existing), duplicate: true },
      });
    }

    const requiredKeys = requiredDocumentKeys(data, settings);
    const files = collectFiles(req, requiredKeys);
    applicationId = generateRiderApplicationId();
    uploaded = await uploadAll(files, applicationId);

    const payload = {
      submissionKey,
      ...data,
      uploadedDocuments: uploaded,
      applicationStatus: 'Submitted',
      notifications: { submitted: { status: 'pending', attempts: 0 } },
    };

    let doc;
    try {
      const created = await createApplication(applicationId, payload);
      if (created.existing) {
        await Promise.all(Object.values(uploaded).map((record) => deleteDocument(record)));
        return res.status(200).json({
          success: true,
          message: 'We already have this application. No duplicate was created.',
          data: { ...sanitizePublicApplication(created.existing), duplicate: true },
        });
      }
      doc = created;
    } catch (err) {
      await Promise.all(Object.values(uploaded).map((record) => deleteDocument(record)));
      throw err;
    }

    await audit(doc, 'APPLICATION_SUBMITTED', actorFromReq(req), {
      source: 'public',
      documentCount: Object.keys(uploaded).length,
    });
    await notifyRiderApplication(doc);

    res.status(201).json({
      success: true,
      message: doc.notifications.submitted.status === 'sent'
        ? 'Your rider application has been received.'
        : 'Your rider application has been saved. Confirmation email delivery is being retried.',
      data: {
        ...sanitizePublicApplication(doc),
        duplicate: false,
        statusUrl: `${env.frontendUrl}/rider/status`,
      },
    });
  } catch (err) {
    if (applicationId && Object.keys(uploaded).length) {
      await Promise.all(Object.values(uploaded).map((record) => deleteDocument(record)));
    }
    next(err);
  }
};

exports.getRiderStatus = async (req, res, next) => {
  try {
    const applicationId = String(req.body.applicationId || '').toUpperCase();
    if (!/^RIDER-\d{8}-[A-Z0-9]{6}$/.test(applicationId)) {
      throw new AppError('Invalid Application ID.', 400);
    }
    const doc = await RiderApplication.findOne({ applicationId });
    if (!doc) throw new AppError('No application found with that ID.', 404);
    res.json({ success: true, data: sanitizePublicApplication(doc) });
  } catch (err) {
    next(err);
  }
};
