const { getSiteSettings } = require('../services/siteService');

exports.getSiteConfig = async (_req, res, next) => {
  try {
    const settings = await getSiteSettings();
    res.json({
      success: true,
      data: {
        serviceCity: settings.serviceCity || 'Vellore',
      },
    });
  } catch (err) {
    next(err);
  }
};
