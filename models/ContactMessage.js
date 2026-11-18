const mongoose = require('mongoose');
const { NOTIFY_STATES } = require('../utils/constants');

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    subject: { type: String, trim: true, maxlength: 140, default: '' },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    notification: {
      status: { type: String, enum: NOTIFY_STATES, default: 'pending' },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, maxlength: 500 },
    },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
