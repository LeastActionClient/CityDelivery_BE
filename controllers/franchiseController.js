const FranchiseApplication = require('../models/FranchiseApplication');
const AppError = require('../utils/AppError');
const { generateFranchiseApplicationId } = require('../utils/generateFranchiseIds');
const {
  FRANCHISE_STATUSES,
  FRANCHISE_INVESTMENT_CAPACITIES,
  FRANCHISE_DOCUMENT_KEYS,
  FRANCHISE_VEHICLE_TYPES,
} = require('../utils/constants');
const { uploadDocument, deleteDocument } = require('../services/franchiseDocumentService');
const { notifyFranchiseApplication } = require('../services/emailService');
const { env } = require('../config/env');
const {
  getFranchiseSettings,
  actorFromReq,
  audit,
  dedupeKeyFor,
  normalizeApplicationData,
  sanitizePublicApplication,
} = require('../services/franchiseService');

async function uploadAll(files, applicationId) {
  const uploaded = {};
  try {
    let index = 0;
    for (const key of FRANCHISE_DOCUMENT_KEYS) {
      const file = files[key];
      if (!file) continue;
      uploaded[key] = await uploadDocument(file.buffer, {
        applicationId,
        field: key,
        index,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
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
    return await FranchiseApplication.create({ applicationId, ...payload });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const existing = await FranchiseApplication.findOne({ submissionKey: payload.submissionKey });
    if (existing) return { existing };
    throw new AppError('Could not generate a unique application ID.', 409);
  }
}

exports.getFranchiseConfig = async (_req, res, next) => {
  try {
    const settings = await getFranchiseSettings();
    res.json({
      success: true,
      data: {
        statuses: FRANCHISE_STATUSES,
        investmentCapacities: FRANCHISE_INVESTMENT_CAPACITIES,
        applicationFee: settings.applicationFee,
        currency: settings.currency,
        refundPolicy: settings.refundPolicy,
        refundPolicyDetails: settings.refundPolicyDetails,
        paymentInstructions: settings.paymentInstructions,
        documents: FRANCHISE_DOCUMENT_KEYS,
        vehicleTypes: FRANCHISE_VEHICLE_TYPES,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.registerFranchise = async (req, res, next) => {
  let uploaded = {};
  let applicationId = null;
  try {
    if (req.body.website) {
      return res.status(201).json({
        success: true,
        message: 'Your franchise application has been received.',
        data: { applicationId: 'FRANCHISE-RECEIVED', applicationStatus: 'Payment Pending', duplicate: false },
      });
    }

    const settings = await getFranchiseSettings();
    const data = normalizeApplicationData(req.body, settings);
    const submissionKey = dedupeKeyFor(data.mobile);
    const existing = await FranchiseApplication.findOne({ submissionKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'We already have this application. No duplicate was created.',
        data: { ...sanitizePublicApplication(existing), duplicate: true },
      });
    }

    const files = req.groupedDocuments || {};
    applicationId = generateFranchiseApplicationId();
    uploaded = await uploadAll(files, applicationId);

    const payload = {
      submissionKey,
      ...data,
      uploadedDocuments: uploaded,
      applicationStatus: 'Payment Pending',
      payment: {
        status: 'PENDING',
        amount: settings.applicationFee,
        currency: settings.currency,
      },
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
      feeAmount: settings.applicationFee,
      refundPolicy: settings.refundPolicy,
    });
    await notifyFranchiseApplication(doc);

    res.status(201).json({
      success: true,
      message: doc.notifications.submitted.status === 'sent'
        ? 'Your franchise application has been received.'
        : 'Your franchise application has been saved. Confirmation email delivery is being retried.',
      data: {
        ...sanitizePublicApplication(doc),
        duplicate: false,
        statusUrl: `${env.frontendUrl}/franchise/status`,
      },
    });
  } catch (err) {
    if (applicationId && Object.keys(uploaded).length) {
      await Promise.all(Object.values(uploaded).map((record) => deleteDocument(record)));
    }
    next(err);
  }
};

exports.getFranchiseStatus = async (req, res, next) => {
  try {
    const applicationId = String(req.body.applicationId || '').toUpperCase();
    if (!/^FRANCH-\d{8}-[A-Z0-9]{6}$/.test(applicationId)) {
      throw new AppError('Invalid Application ID.', 400);
    }
    const doc = await FranchiseApplication.findOne({ applicationId });
    if (!doc) throw new AppError('No application found with that ID.', 404);
    res.json({ success: true, data: sanitizePublicApplication(doc) });
  } catch (err) {
    next(err);
  }
};

exports.locatableStatuses = FRANCHISE_STATUSES;
