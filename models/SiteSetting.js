const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    serviceCity: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'Vellore',
    },
    updatedBy: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSetting', siteSettingSchema);
