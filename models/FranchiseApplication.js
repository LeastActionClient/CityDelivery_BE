const mongoose = require('mongoose');
const {
  FRANCHISE_STATUSES,
  FRANCHISE_PAYMENT_STATUSES,
  FRANCHISE_INVESTMENT_CAPACITIES,
  FRANCHISE_VEHICLE_TYPES,
  NOTIFY_STATES,
} = require('../utils/constants');

const notificationSchema = new mongoose.Schema(
  {
    status: { type: String, enum: NOTIFY_STATES, default: 'not_applicable' },
    attempts: { type: Number, default: 0 },
    sentAt: Date,
    lastError: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    format: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
    originalName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, trim: true, maxlength: 200 },
    type: { type: String, trim: true, maxlength: 120 },
    receivedAt: { type: Date, default: Date.now },
    message: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: FRANCHISE_VEHICLE_TYPES, trim: true },
    otherType: { type: String, trim: true, maxlength: 80, default: '' },
    count: { type: Number, required: true, min: 1, max: 1000, default: 1 },
  },
  { _id: false }
);

const franchiseApplicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    franchiseId: { type: String, unique: true, sparse: true, index: true },
    submissionKey: { type: String, unique: true, sparse: true, index: true },

    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    mobile: { type: String, required: true, trim: true, maxlength: 24, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '', index: true },

    location: {
      state: { type: String, required: true, trim: true, maxlength: 80 },
      district: { type: String, required: true, trim: true, maxlength: 80 },
      city: { type: String, required: true, trim: true, maxlength: 80, index: true },
      preferredOperatingArea: { type: String, required: true, trim: true, maxlength: 160, index: true },
      pincode: { type: String, required: true, trim: true, maxlength: 12 },
      fullAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
    },

    business: {
      experience: { type: String, trim: true, maxlength: 1000, default: '' },
      investmentCapacity: { type: String, required: true, enum: FRANCHISE_INVESTMENT_CAPACITIES },
      hasOfficeOrShop: { type: Boolean, required: true },
      numberOfVehicles: { type: Number, default: 0, min: 0, max: 10000 },
      vehicles: { type: [vehicleSchema], default: [] },
      motivation: { type: String, trim: true, maxlength: 1500, default: '' },
    },

    uploadedDocuments: { type: Map, of: documentSchema, default: () => ({}) },

    feeSnapshot: {
      amount: { type: Number, required: true, min: 1, default: 1000 },
      currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
      refundPolicy: { type: String, required: true, trim: true, maxlength: 40, default: 'Non-refundable' },
      refundPolicyDetails: { type: String, trim: true, maxlength: 1000, default: '' },
    },

    payment: {
      status: { type: String, required: true, enum: FRANCHISE_PAYMENT_STATUSES, default: 'PENDING', index: true },
      provider: { type: String, trim: true, maxlength: 40, default: 'MANUAL' },
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, trim: true, maxlength: 8, default: 'INR' },
      transactionId: { type: String, trim: true, maxlength: 120, default: '', index: true },
      paymentMethod: { type: String, trim: true, maxlength: 120, default: '' },
      paidAt: Date,
      lastError: { type: String, trim: true, maxlength: 500, default: '' },
      events: { type: [paymentEventSchema], default: [] },
    },

    applicationStatus: {
      type: String,
      required: true,
      enum: FRANCHISE_STATUSES,
      default: 'Under Review',
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
    adminRemarks: { type: String, trim: true, maxlength: 1000, default: '' },
    adminNotes: {
      type: [
        new mongoose.Schema(
          {
            text: { type: String, required: true, trim: true, maxlength: 1000 },
            actor: { type: String, required: true, trim: true, maxlength: 120 },
            role: { type: String, trim: true, maxlength: 40, default: '' },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    infoRequest: {
      message: { type: String, trim: true, maxlength: 1000, default: '' },
      requestedAt: Date,
      requestedBy: { type: String, trim: true, maxlength: 120, default: '' },
    },

    approvedAt: Date,
    approvedBy: { type: String, trim: true, maxlength: 120, default: '' },
    activatedAt: Date,

    notifications: {
      submitted: { type: notificationSchema, default: () => ({ status: 'pending' }) },
      paymentSuccess: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      underReview: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      approved: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      rejected: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      additionalInfoRequested: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      agreementPending: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      activated: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
    },
  },
  { timestamps: true }
);

franchiseApplicationSchema.index({ applicationStatus: 1, createdAt: -1 });
franchiseApplicationSchema.index({ mobile: 1, createdAt: -1 });
franchiseApplicationSchema.index({ email: 1, createdAt: -1 });
franchiseApplicationSchema.index({ 'location.city': 1, createdAt: -1 });
franchiseApplicationSchema.index({ 'location.preferredOperatingArea': 1, createdAt: -1 });

module.exports = mongoose.model('FranchiseApplication', franchiseApplicationSchema);
