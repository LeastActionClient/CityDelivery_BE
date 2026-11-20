const mongoose = require('mongoose');
const { RIDER_VEHICLE_TYPES } = require('../utils/constants');

const riderSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    allowedVehicleTypes: {
      type: [String],
      enum: RIDER_VEHICLE_TYPES,
      default: ['Motorcycle', 'Scooter', 'Electric Bike', 'Three Wheeler'],
    },
    requireInsurance: { type: Boolean, default: true },
    requireAadhaar: { type: Boolean, default: false },
    updatedBy: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RiderSetting', riderSettingSchema);
