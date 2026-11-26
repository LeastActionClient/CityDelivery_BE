const SiteSetting = require('../models/SiteSetting');
const { cleanText } = require('../utils/sanitize');

async function getSiteSettings() {
  return SiteSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', serviceCity: 'Vellore' } },
    { new: true, upsert: true }
  ).lean();
}

function actorFromReq(req) {
  return cleanText(req.get('x-admin-actor') || 'admin').slice(0, 120) || 'admin';
}

module.exports = { getSiteSettings, actorFromReq };
