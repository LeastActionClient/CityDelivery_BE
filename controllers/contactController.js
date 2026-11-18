const ContactMessage = require('../models/ContactMessage');
const { notifyContact } = require('../services/emailService');

// POST /api/contact
exports.createContact = async (req, res, next) => {
  try {
    if (req.body.website) {
      return res.status(201).json({ success: true, message: 'Thanks — your message has been sent.' });
    }
    const { name, email, subject, message } = req.body;
    const doc = await ContactMessage.create({ name, email, subject: subject || '', message });
    await notifyContact(doc);
    res.status(201).json({
      success: true,
      message: 'Thanks — your message has been received. We will get back to you soon.',
    });
  } catch (err) {
    next(err);
  }
};
