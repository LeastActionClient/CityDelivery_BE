const mongoose = require('mongoose');
const {
  RIDER_STATUSES,
  RIDER_WORK_TYPES,
  RIDER_VEHICLE_TYPES,
  RIDER_GENDERS,
  RIDER_AVAILABILITY_DAYS,
  NOTIFY_STATES,
} = require('../utils/constants');

const notificationSchema = new mongoose.Schema(
  {
    status: { type: String, enum: NOTIFY_STATES, default: 'pending' },
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

const riderApplicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    submissionKey: { type: String, unique: true, sparse: true, index: true },
    riderId: { type: String, unique: true, sparse: true, index: true },

    personalInformation: {
      fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
      dateOfBirth: { type: Date, required: true },
      gender: { type: String, enum: ['', ...RIDER_GENDERS], default: '' },
    },

    contactInformation: {
      mobile: { type: String, required: true, trim: true, maxlength: 24, index: true },
      whatsapp: { type: String, trim: true, maxlength: 24, default: '' },
      email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '', index: true },
      emergencyContactName: { type: String, trim: true, maxlength: 80, default: '' },
      emergencyContactNumber: { type: String, trim: true, maxlength: 24, default: '' },
    },

    address: {
      residentialAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
      city: { type: String, required: true, trim: true, default: 'Vellore', maxlength: 80 },
      area: { type: String, required: true, trim: true, maxlength: 120 },
      pincode: { type: String, required: true, trim: true, maxlength: 12 },
    },

    drivingInformation: {
      licenceNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
      experience: { type: String, required: true, trim: true, maxlength: 60 },
    },

    vehicleInformation: {
      ownsVehicle: { type: Boolean, required: true },
      assistanceRequired: { type: Boolean, default: false },
      vehicleType: { type: String, enum: ['', ...RIDER_VEHICLE_TYPES], default: '' },
      registrationNumber: { type: String, trim: true, uppercase: true, maxlength: 30, default: '' },
      brand: { type: String, trim: true, maxlength: 60, default: '' },
      model: { type: String, trim: true, maxlength: 60, default: '' },
      insuranceAvailable: { type: Boolean, default: false },
    },

    workPreferences: {
      preferredWorkingArea: { type: String, required: true, trim: true, maxlength: 160 },
      workType: { type: String, required: true, enum: RIDER_WORK_TYPES },
      preferredWorkingHours: { type: String, trim: true, maxlength: 120, default: '' },
      availabilityDays: { type: [String], enum: RIDER_AVAILABILITY_DAYS, default: [] },
    },

    identityVerification: {
      aadhaarConsent: { type: Boolean, default: false },
      aadhaarNumber: { type: String, trim: true, maxlength: 32, default: '' },
      panConsent: { type: Boolean, required: true, default: false },
      panNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 10, default: '' },
      additionalNotes: { type: String, trim: true, maxlength: 600, default: '' },
    },

    paymentInformation: {
      submitted: { type: Boolean, default: false },
      accountHolderName: { type: String, trim: true, maxlength: 80, default: '' },
      bankName: { type: String, trim: true, maxlength: 80, default: '' },
      accountNumber: { type: String, trim: true, maxlength: 40, default: '' },
      ifscCode: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
      upiId: { type: String, trim: true, maxlength: 120, default: '' },
    },

    uploadedDocuments: { type: Map, of: documentSchema, default: () => ({}) },

    applicationStatus: { type: String, required: true, enum: RIDER_STATUSES, default: 'Submitted', index: true },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
    adminRemarks: { type: String, trim: true, maxlength: 1000, default: '' },
    additionalDocumentRequest: {
      message: { type: String, trim: true, maxlength: 1000, default: '' },
      requestedAt: Date,
      requestedBy: { type: String, trim: true, maxlength: 120, default: '' },
    },

    active: { type: Boolean, default: false },
    approvedAt: Date,
    approvedBy: { type: String, trim: true, maxlength: 120, default: '' },
    activatedAt: Date,
    deactivatedAt: Date,

    notifications: {
      submitted: { type: notificationSchema, default: () => ({ status: 'pending' }) },
      approval: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      rejection: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      documentsRequested: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
      activation: { type: notificationSchema, default: () => ({ status: 'not_applicable' }) },
    },
  },
  { timestamps: true }
);

riderApplicationSchema.index({ applicationStatus: 1, createdAt: -1 });
riderApplicationSchema.index({ 'address.area': 1, createdAt: -1 });
riderApplicationSchema.index({ 'vehicleInformation.vehicleType': 1, createdAt: -1 });
riderApplicationSchema.index({ 'contactInformation.mobile': 1, createdAt: -1 });

module.exports = mongoose.model('RiderApplication', riderApplicationSchema);
