const { body } = require('express-validator');
const { CATEGORIES } = require('../utils/constants');
const { cleanText } = require('../utils/sanitize');

const text = (field, { min, max, label, multiline = false, optional = false }) => {
  let chain = body(field)
    .customSanitizer((v) => cleanText(v, { multiline }));
  if (optional) {
    chain = chain.optional({ values: 'falsy' });
  } else {
    chain = chain.notEmpty().withMessage(`${label} is required.`).bail();
  }
  return chain.isLength({ min: optional ? 0 : min, max }).withMessage(
    optional ? `${label} must be at most ${max} characters.` : `${label} must be between ${min} and ${max} characters.`
  );
};

const submissionKeyRule = body('submissionKey')
  .optional({ values: 'falsy' })
  .trim()
  .matches(/^[A-Za-z0-9_-]{16,64}$/)
  .withMessage('Invalid submission key.');

const productRequestRules = [
  text('customerName', { min: 2, max: 80, label: 'Name' }),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.').bail()
    .isEmail().withMessage('Please enter a valid email address.').bail()
    .isLength({ max: 120 }).withMessage('Email is too long.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('phone')
    .customSanitizer((v) => cleanText(v))
    .notEmpty().withMessage('Mobile number is required.').bail()
    .matches(/^\+?[\d\s()-]{7,18}$/).withMessage('Please enter a valid mobile number.')
    .custom((v) => v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15)
    .withMessage('Please enter a valid mobile number.'),

  text('productName', { min: 2, max: 120, label: 'Product name' }),
  body('productCategory')
    .trim()
    .isIn(CATEGORIES).withMessage('Please choose a product category.'),
  text('storeName', { min: 2, max: 120, label: 'Store name' }),
  text('storeLocation', { min: 2, max: 200, label: 'Store location' }),
  text('productDescription', { min: 10, max: 1500, label: 'Description', multiline: true }),
  body('quantity')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100.')
    .toInt(),
  body('estimatedBudget')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 10000000 }).withMessage('Budget must be a positive number.')
    .toFloat(),

  text('deliveryAddress', { min: 5, max: 300, label: 'Delivery address', multiline: true }),
  text('city', { min: 2, max: 80, label: 'City' }),
  body('postalCode')
    .customSanitizer((v) => cleanText(v))
    .notEmpty().withMessage('Postal code is required.').bail()
    .matches(/^[A-Za-z0-9][A-Za-z0-9\s-]{2,10}$/).withMessage('Please enter a valid postal code.'),
  text('additionalInstructions', { max: 600, label: 'Instructions', multiline: true, optional: true }),
  submissionKeyRule,
];

const contactRules = [
  text('name', { min: 2, max: 80, label: 'Name' }),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.').bail()
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  text('subject', { max: 140, label: 'Subject', optional: true }),
  text('message', { min: 10, max: 2000, label: 'Message', multiline: true }),
];

module.exports = { productRequestRules, contactRules };
