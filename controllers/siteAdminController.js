const SiteSetting = require('../models/SiteSetting');
const AppError = require('../utils/AppError');
const { cleanText } = require('../utils/sanitize');
const { actorFromReq, getSiteSettings } = require('../services/siteService');

exports.adminGetSettings = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getSiteSettings() });
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateSettings = async (req, res, next) => {
  try {
    const current = await getSiteSettings();
    const serviceCity = cleanText(req.body.serviceCity).slice(0, 200);
    if (!serviceCity) {
      throw new AppError('Please enter the city or cities where we serve.', 422);
    }

    const settings = await SiteSetting.findByIdAndUpdate(
      current._id,
      { $set: { serviceCity, updatedBy: actorFromReq(req) } },
      { new: true }
    ).lean();

    res.json({
      success: true,
      message: 'Footer service city updated.',
      data: settings,
    });
  } catch (err) {
    next(err);
  }
};
