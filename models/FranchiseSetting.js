const mongoose = require('mongoose');
const { FRANCHISE_REFUND_POLICIES } = require('../utils/constants');

const franchiseSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    applicationFee: { type: Number, required: true, min: 1, max: 100000, default: 1000 },
    currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
    refundPolicy: {
      type: String,
      required: true,
      enum: FRANCHISE_REFUND_POLICIES,
      default: 'Non-refundable',
    },
    refundPolicyDetails: { type: String, trim: true, maxlength: 1000, default: '' },
    paymentInstructions: { type: String, trim: true, maxlength: 1000, default: '' },
    updatedBy: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FranchiseSetting', franchiseSettingSchema);
