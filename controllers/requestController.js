const ProductRequest = require('../models/ProductRequest');
const AppError = require('../utils/AppError');
const { generateRequestId } = require('../utils/generateRequestId');
const { uploadProductImage, deleteImage } = require('../services/cloudinaryService');
const { notifyRequest } = require('../services/emailService');
const { env } = require('../config/env');
const { STATUSES, REQUEST_NEXT_STEPS, PROHIBITED_ITEMS_POLICY_VERSION } = require('../utils/constants');

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_ID_PATTERN = /^CDS-\d{8}-[A-Z0-9]{6}$/;

/** Only non-sensitive fields ever leave the server on the public endpoint. */
function publicView(doc, { duplicate = false } = {}) {
  return {
    requestId: doc.requestId,
    status: doc.status,
    createdAt: doc.createdAt,
    duplicate,
    notifications: {
      team: doc.ownerNotification.status,
      confirmationEmail: doc.customerNotification.status,
    },
  };
}

function successMessage(doc, duplicate) {
  if (duplicate) return 'We already have this request. Your original submission is safe — no duplicate was created.';
  const teamOk = doc.ownerNotification.status === 'sent';
  return teamOk
    ? 'Your request has been received. Our team will contact you with the next steps.'
    : 'Your request has been saved. Our team will see it shortly — email delivery is being retried in the background.';
}

// POST /api/requests
exports.createRequest = async (req, res, next) => {
  try {
    // Honeypot: real users never see this field. Pretend success so bots learn nothing.
    if (req.body.website) {
      return res.status(201).json({
        success: true,
        message: 'Your request has been received.',
        data: { requestId: 'CDS-RECEIVED', status: 'Pending', duplicate: false, notifications: {} },
      });
    }

    const b = req.body;
    const submissionKey = b.submissionKey || undefined;

    // 1) Idempotency — same submission key => return the stored request, never create another.
    if (submissionKey) {
      const existing = await ProductRequest.findOne({ submissionKey });
      if (existing) {
        if (existing.ownerNotification.status !== 'sent' || existing.customerNotification.status !== 'sent') {
          await notifyRequest(existing); // opportunistic retry on customer re-submit
        }
        return res.status(200).json({ success: true, message: successMessage(existing, true), data: publicView(existing, { duplicate: true }) });
      }
    }

    // 2) Soft duplicate check — identical customer/product/store within a few minutes.
    const recent = await ProductRequest.findOne({
      email: b.email,
      productName: b.productName,
      storeName: b.storeName,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    }).setOptions({ sanitizeFilter: false });
    if (recent) {
      return res.status(200).json({ success: true, message: successMessage(recent, true), data: publicView(recent, { duplicate: true }) });
    }

    // 3) Create the ID first, then upload the image (so the Cloudinary public_id matches the request).
    const requestId = generateRequestId();
    let productImage;
    if (req.file) {
      productImage = await uploadProductImage(req.file.buffer, requestId);
    }

    // 4) Save BEFORE sending any email. Email problems must never lose a request.
    let doc;
    try {
      doc = await ProductRequest.create({
        requestId,
        submissionKey,
        customerName: b.customerName,
        email: b.email,
        phone: b.phone,
        productName: b.productName,
        productCategory: b.productCategory,
        storeName: b.storeName,
        storeLocation: b.storeLocation,
        productDescription: b.productDescription,
        quantity: b.quantity || 1,
        estimatedBudget: b.estimatedBudget ?? null,
        productImage,
        deliveryAddress: b.deliveryAddress,
        city: b.city,
        postalCode: b.postalCode,
        additionalInstructions: b.additionalInstructions || '',
        prohibitedItemsDeclaration: {
          accepted: true,
          acceptedAt: new Date(),
          policyVersion: PROHIBITED_ITEMS_POLICY_VERSION,
        },
      });
    } catch (err) {
      if (productImage?.publicId) await deleteImage(productImage.publicId);
      if (err.code === 11000) {
        // Race: two identical submissions hit at once. Return the one that won.
        const winner = submissionKey && (await ProductRequest.findOne({ submissionKey }));
        if (winner) {
          return res.status(200).json({ success: true, message: successMessage(winner, true), data: publicView(winner, { duplicate: true }) });
        }
        throw new AppError('Could not generate a unique request ID. Please try again.', 409);
      }
      throw err;
    }

    // 5) Notifications are attempted now, but their outcome is recorded separately.
    await notifyRequest(doc);

    res.status(201).json({ success: true, message: successMessage(doc, false), data: publicView(doc) });
  } catch (err) {
    next(err);
  }
};

function statusPayload(doc) {
  return {
    requestId: doc.requestId,
    status: doc.status,
    nextSteps: REQUEST_NEXT_STEPS[doc.status] || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

exports.getRequestStatus = async (req, res, next) => {
  try {
    const id = String(req.params.requestId || '').toUpperCase();
    if (!REQUEST_ID_PATTERN.test(id)) throw new AppError('Invalid request ID.', 400);
    const doc = await ProductRequest.findOne({ requestId: id }).select('requestId status createdAt updatedAt');
    if (!doc) throw new AppError('Request not found.', 404);
    res.json({ success: true, data: statusPayload(doc) });
  } catch (err) {
    next(err);
  }
};

exports.getRequestStatusBulk = async (req, res, next) => {
  try {
    const raw = Array.isArray(req.body?.requestIds) ? req.body.requestIds : [];
    const ids = [...new Set(raw.map((id) => String(id || '').toUpperCase()).filter(Boolean))];
    if (!ids.length) throw new AppError('Provide at least one request ID.', 400);
    if (ids.length > 50) throw new AppError('You can check up to 50 requests at a time.', 400);
    if (ids.some((id) => !REQUEST_ID_PATTERN.test(id))) throw new AppError('Invalid request ID.', 400);

    const docs = await ProductRequest.find({ requestId: { $in: ids } })
      .select('requestId status createdAt updatedAt')
      .lean();
    const byId = new Map(docs.map((doc) => [doc.requestId, statusPayload(doc)]));
    const items = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)] : []));
    const missing = ids.filter((id) => !byId.has(id));

    res.json({ success: true, data: { items, missing } });
  } catch (err) {
    next(err);
  }
};

// ---------------- Admin (x-api-key) ----------------

// GET /api/admin/requests?status=&notified=failed&page=&limit=
exports.adminList = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.status) {
      if (!STATUSES.includes(String(req.query.status))) throw new AppError('Invalid status filter.', 400);
      filter.status = String(req.query.status);
    }
    if (req.query.notified === 'failed') {
      filter.$or = [{ 'ownerNotification.status': { $ne: 'sent' } }, { 'customerNotification.status': { $ne: 'sent' } }];
    }
    const [items, total] = await Promise.all([
      ProductRequest.find(filter).setOptions({ sanitizeFilter: false }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProductRequest.countDocuments(filter).setOptions({ sanitizeFilter: false }),
    ]);
    res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/requests/:requestId/status  { status }
exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (!STATUSES.includes(status)) throw new AppError(`Status must be one of: ${STATUSES.join(', ')}`, 422);
    const doc = await ProductRequest.findOneAndUpdate(
      { requestId: String(req.params.requestId) },
      { status },
      { new: true }
    );
    if (!doc) throw new AppError('Request not found.', 404);
    res.json({ success: true, data: { requestId: doc.requestId, status: doc.status } });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/requests/:requestId/retry-notifications
exports.adminRetryNotifications = async (req, res, next) => {
  try {
    if (!env.smtpConfigured) throw new AppError('SMTP is not configured.', 503);
    const doc = await ProductRequest.findOne({ requestId: String(req.params.requestId) });
    if (!doc) throw new AppError('Request not found.', 404);
    const result = await notifyRequest(doc);
    res.json({
      success: true,
      data: {
        requestId: doc.requestId,
        owner: result.owner,
        customer: result.customer,
        ownerError: doc.ownerNotification.lastError,
        customerError: doc.customerNotification.lastError,
      },
    });
  } catch (err) {
    next(err);
  }
};
