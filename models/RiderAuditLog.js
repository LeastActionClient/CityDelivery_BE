const mongoose = require('mongoose');

const riderAuditLogSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, index: true },
    riderApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'RiderApplication', required: true },
    action: { type: String, required: true, maxlength: 80 },
    actor: { type: String, required: true, maxlength: 120 },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

riderAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('RiderAuditLog', riderAuditLogSchema);
