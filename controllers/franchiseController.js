const FranchiseApplication = require('../models/FranchiseApplication');
const AppError = require('../utils/AppError');
const {
  generateFranchiseApplicationId,
  generateFranchiseOrderId,
} = require('../utils/generateFranchiseIds');
const {
  FRANCHISE_STATUSES,
  FRANCHISE_INVESTMENT_CAPACITIES,
  FRANCHISE_DOCUMENT_KEYS,
  FRANCHISE_VEHICLE_TYPES,
} = require('../utils/constants');
const { uploadDocument, deleteDocument } = require('../services/franchiseDocumentService');
const { notifyFranchiseApplication, notifyFranchiseUpdate } = require('../services/emailService');
const { env } = require('../config/env');
const cashfree = require('../services/cashfreeService');
const {
  getFranchiseSettings,
  actorFromReq,
  audit,
  dedupeKeyFor,
  normalizeApplicationData,
  sanitizePublicApplication,
  applyPaymentUpdate,
  resetNotification,
} = require('../services/franchiseService');

function locateApplication(value) {
  const id = String(value || '').trim();
  if (/^[0-9a-fA-F]{24}$/.test(id)) return FranchiseApplication.findOne({ _id: id });
  return FranchiseApplication.findOne({ applicationId: id });
}

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

function paymentDetailsFromOrder(order) {
  const raw = order?.payment_details;
  const details = Array.isArray(raw) ? raw[raw.length - 1] : raw || {};
  return {
    transactionId: details.transaction_id || details.cf_payment_id || details.payment_id || order?.cf_order_id || '',
    paymentMethod: details.payment_method || details.payment_group || '',
    paidAt: details.payment_time || order?.order_expiry_time || null,
  };
}

async function recordPaymentUpdate(doc, update, { notify = true } = {}) {
  const result = applyPaymentUpdate(doc, update);
  if (!result.newEvent && !result.becamePaid) return result;
  await doc.save();

  if (result.becamePaid) {
    resetNotification(doc.notifications.paymentSuccess);
    await audit(
      doc,
      'PAYMENT_SUCCESS',
      actorFromReq({ get: () => 'payment-gateway' }),
      {
        orderId: doc.payment.orderId,
        transactionId: doc.payment.transactionId,
        amount: doc.payment.amount,
      },
      'system'
    );
    if (notify) await notifyFranchiseUpdate(doc, 'paymentSuccess');
  } else if (update.status === 'FAILED' && result.newEvent) {
    await audit(
      doc,
      'PAYMENT_FAILED',
      'payment-gateway',
      { orderId: doc.payment.orderId, message: doc.payment.lastError },
      'system'
    );
  }
  return result;
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
        payment: cashfree.getConfig(),
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
          data: {
            ...sanitizePublicApplication(created.existing),
            duplicate: true,
            paymentConfigured: cashfree.isConfigured(),
          },
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
        paymentConfigured: cashfree.isConfigured(),
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
    res.json({
      success: true,
      data: {
        ...sanitizePublicApplication(doc),
        paymentConfigured: cashfree.isConfigured(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createPaymentOrder = async (req, res, next) => {
  try {
    cashfree.assertConfigured();
    const doc = await locateApplication(req.body.applicationId);
    if (!doc) throw new AppError('No application found with that ID.', 404);

    if (doc.payment.status === 'PAID') {
      return res.json({
        success: true,
        alreadyPaid: true,
        data: { ...sanitizePublicApplication(doc), paymentSessionId: '' },
      });
    }

    if (doc.payment.orderId && doc.payment.paymentSessionId) {
      try {
        const existingOrder = await cashfree.getOrder(doc.payment.orderId);
        const existingStatus = String(existingOrder.order_status || '').toUpperCase();
        if (existingStatus === 'PAID') {
          await recordPaymentUpdate(doc, {
            status: 'PAID',
            orderStatus: existingStatus,
            ...paymentDetailsFromOrder(existingOrder),
            eventId: `recover:${doc.payment.orderId}`,
            type: 'RECOVERED_PAID_ORDER',
          });
          return res.json({
            success: true,
            alreadyPaid: true,
            data: { ...sanitizePublicApplication(doc), paymentSessionId: '' },
          });
        }
        if (['ACTIVE', 'PENDING'].includes(existingStatus)) {
          return res.json({
            success: true,
            data: {
              paymentSessionId: doc.payment.paymentSessionId,
              orderId: doc.payment.orderId,
              amount: doc.payment.amount || doc.feeSnapshot.amount,
              currency: doc.feeSnapshot.currency,
              environment: env.cashfree.environment,
            },
          });
        }
      } catch (err) {
        console.warn('[franchise] could not recover existing order:', err.message);
      }
    }

    const attempt = (doc.payment.attempts || 0) + 1;
    const orderId = generateFranchiseOrderId(doc.applicationId, attempt);
    const returnUrl = `${env.frontendUrl}/franchise/status?applicationId=${encodeURIComponent(doc.applicationId)}&payment=return`;
    const order = await cashfree.createOrder({
      orderId,
      amount: doc.feeSnapshot.amount,
      customer: {
        customerId: doc.applicationId,
        name: doc.fullName,
        email: doc.email,
        phone: doc.mobile,
      },
      returnUrl,
      notifyUrl: env.cashfree.webhookUrl || undefined,
    });

    doc.payment.status = 'PENDING';
    doc.payment.provider = 'Cashfree';
    doc.payment.orderId = orderId;
    doc.payment.paymentSessionId = order.payment_session_id || order.paymentSessionId || '';
    doc.payment.cfOrderId = order.cf_order_id || '';
    doc.payment.orderStatus = order.order_status || 'ACTIVE';
    doc.payment.amount = Number(order.order_amount || doc.feeSnapshot.amount);
    doc.payment.currency = order.order_currency || doc.feeSnapshot.currency;
    doc.payment.attempts = attempt;
    doc.payment.lastError = '';
    await doc.save();
    await audit(doc, 'PAYMENT_ORDER_CREATED', actorFromReq(req), { orderId, attempt });

    if (!doc.payment.paymentSessionId) {
      throw new AppError('The payment provider did not return a session. Please try again.', 502);
    }

    res.json({
      success: true,
      data: {
        paymentSessionId: doc.payment.paymentSessionId,
        orderId,
        amount: doc.payment.amount,
        currency: doc.payment.currency,
        environment: env.cashfree.environment,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    cashfree.assertConfigured();
    const doc = await locateApplication(req.body.applicationId);
    if (!doc) throw new AppError('No application found with that ID.', 404);
    if (!doc.payment.orderId) throw new AppError('Payment has not been started for this application.', 409);

    const order = await cashfree.getOrder(doc.payment.orderId);
    const orderStatus = String(order.order_status || '').toUpperCase();
    const details = paymentDetailsFromOrder(order);

    if (orderStatus === 'PAID') {
      await recordPaymentUpdate(doc, {
        status: 'PAID',
        orderStatus,
        ...details,
        eventId: `verify:${doc.payment.orderId}:${details.transactionId || 'paid'}`,
        type: 'MANUAL_VERIFY',
      });
    } else {
      doc.payment.orderStatus = orderStatus || doc.payment.orderStatus;
      doc.payment.lastError = orderStatus === 'FAILED' ? 'Payment was not completed.' : '';
      await doc.save();
    }

    res.json({
      success: true,
      data: { ...sanitizePublicApplication(doc), providerOrderStatus: orderStatus || null },
    });
  } catch (err) {
    next(err);
  }
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature = req.get('x-webhook-signature') || '';
    const timestamp = req.get('x-webhook-timestamp') || '';
    if (!cashfree.verifyWebhookSignature(rawBody, signature, timestamp)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const payload = cashfree.parseWebhookBody(rawBody);
    const eventId = String(
      req.get('x-idempotency-key') || payload.event_id || payload.id || payload.data?.event_id || ''
    ).slice(0, 200);
    const eventType = String(payload.type || payload.event || '').slice(0, 120);
    const orderId = String(
      payload.data?.order?.order_id ||
        payload.data?.order_id ||
        payload.order_id ||
        payload.data?.payment?.order_id ||
        ''
    ).slice(0, 60);
    if (!orderId) return res.json({ received: true, ignored: true });

    const doc = await FranchiseApplication.findOne({ 'payment.orderId': orderId });
    if (!doc) return res.json({ received: true, ignored: true });

    let order;
    try {
      order = await cashfree.getOrder(orderId);
    } catch (err) {
      console.error('[franchise] webhook order verification failed:', err.message);
      return res.status(502).json({ success: false, message: 'Could not verify order with payment provider.' });
    }

    const orderStatus = String(order.order_status || '').toUpperCase();
    const details = paymentDetailsFromOrder(order);
    if (orderStatus === 'PAID') {
      await recordPaymentUpdate(doc, {
        status: 'PAID',
        orderStatus,
        ...details,
        eventId: eventId || `webhook:${orderId}:paid`,
        type: eventType || 'PAYMENT_SUCCESS_WEBHOOK',
      });
    } else if (orderStatus === 'FAILED' && !['CANCELLED', 'EXPIRED'].includes(orderStatus)) {
      await recordPaymentUpdate(doc, {
        status: 'FAILED',
        orderStatus,
        eventId: eventId || `webhook:${orderId}:failed`,
        type: eventType || 'PAYMENT_FAILED_WEBHOOK',
        message: order.order_status || 'Payment was not completed.',
      });
    } else {
      applyPaymentUpdate(doc, {
        orderStatus,
        eventId: eventId || `webhook:${orderId}:${orderStatus || 'update'}`,
        type: eventType || 'WEBHOOK_UPDATE',
      });
      await doc.save();
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

exports.locatableStatuses = FRANCHISE_STATUSES;
