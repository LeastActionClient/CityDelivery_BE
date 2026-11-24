const mongoose = require('mongoose');

const franchiseAuditLogSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, index: true },
    franchiseApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'FranchiseApplication', required: true },
    action: { type: String, required: true, maxlength: 80 },
    actor: { type: String, required: true, maxlength: 120 },
    role: { type: String, trim: true, maxlength: 40, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

franchiseAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FranchiseAuditLog', franchiseAuditLogSchema);
