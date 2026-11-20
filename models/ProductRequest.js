const mongoose = require('mongoose');
const { CATEGORIES, STATUSES, NOTIFY_STATES, PROHIBITED_ITEMS_POLICY_VERSION } = require('../utils/constants');

const notificationSchema = new mongoose.Schema(
  {
    status: { type: String, enum: NOTIFY_STATES, default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
    sentAt: Date,
    lastError: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const productRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    // Client-generated UUID, reused on retries -> makes POST /api/requests idempotent.
    submissionKey: { type: String, unique: true, sparse: true, index: true },

    customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '', index: true },
    phone: { type: String, required: true, trim: true, maxlength: 24 },

    productName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    productCategory: { type: String, required: true, enum: CATEGORIES },
    storeName: { type: String, trim: true, maxlength: 120, default: '' },
    storeLocation: { type: String, trim: true, maxlength: 200, default: '' },
    productDescription: { type: String, trim: true, maxlength: 1500, default: '' },
    quantity: { type: Number, required: true, min: 1, max: 100, default: 1 },
    estimatedBudget: { type: Number, min: 0, max: 10000000, default: null },
    productImage: {
      url: String,
      publicId: String,
      width: Number,
      height: Number,
      bytes: Number,
    },

    deliveryAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
    city: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    additionalInstructions: { type: String, trim: true, maxlength: 600, default: '' },

    prohibitedItemsDeclaration: {
      accepted: { type: Boolean, required: true, default: false },
      acceptedAt: { type: Date, required: true, default: Date.now },
      policyVersion: { type: String, required: true, trim: true, maxlength: 40, default: PROHIBITED_ITEMS_POLICY_VERSION },
    },

    status: { type: String, enum: STATUSES, default: 'Pending', index: true },

    ownerNotification: { type: notificationSchema, default: () => ({}) },
    customerNotification: { type: notificationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

productRequestSchema.index({ createdAt: -1 });
// Supports the retry worker query
productRequestSchema.index({
  'ownerNotification.status': 1,
  'customerNotification.status': 1,
  createdAt: -1,
});
// Supports the "same customer re-submits the same thing" duplicate check
productRequestSchema.index({ email: 1, productName: 1, storeName: 1, createdAt: -1 });

module.exports = mongoose.model('ProductRequest', productRequestSchema);
