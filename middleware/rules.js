const { body } = require('express-validator');
const {
  CATEGORIES,
  RIDER_WORK_TYPES,
  RIDER_VEHICLE_TYPES,
  RIDER_GENDERS,
  RIDER_AVAILABILITY_DAYS,
} = require('../utils/constants');
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
    .optional({ values: 'falsy' })
    .trim()
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
  text('storeName', { min: 2, max: 120, label: 'Store name', optional: true }),
  text('storeLocation', { min: 2, max: 200, label: 'Store location', optional: true }),
  text('productDescription', { min: 10, max: 1500, label: 'Description', multiline: true, optional: true }),
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
  body('prohibitedItemsAccepted')
    .isBoolean({ loose: true }).withMessage('Please confirm that your parcel contains only permitted items.').bail()
    .toBoolean()
    .custom((value) => value === true).withMessage('Please confirm that your parcel contains only permitted items.'),
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

const phoneRule = (field, label, optional = false) => {
  let chain = body(field).customSanitizer((v) => cleanText(v));
  if (optional) chain = chain.optional({ values: 'falsy' });
  else chain = chain.notEmpty().withMessage(`${label} is required.`).bail();
  return chain
    .matches(/^\+?[\d\s()-]{7,18}$/).withMessage(`Please enter a valid ${label.toLowerCase()}.`)
    .custom((v) => {
      const digits = String(v).replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    }).withMessage(`Please enter a valid ${label.toLowerCase()}.`);
};

const riderRegistrationRules = [
  text('personalInformation.fullName', { min: 2, max: 80, label: 'Full name' }),
  phoneRule('contactInformation.mobile', 'Mobile number'),
  phoneRule('contactInformation.whatsapp', 'WhatsApp number', true),
  body('contactInformation.email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail().withMessage('Please enter a valid email address.').bail()
    .isLength({ max: 120 }).withMessage('Email is too long.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('personalInformation.dateOfBirth')
    .notEmpty().withMessage('Date of birth is required.').bail()
    .isISO8601({ strict: true }).withMessage('Please enter a valid date of birth.').bail()
    .custom((value) => {
      const dob = new Date(value);
      const now = new Date();
      const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 18 && age <= 80;
    }).withMessage('You must be at least 18 years old to apply.'),
  body('personalInformation.gender')
    .optional({ values: 'falsy' })
    .isIn(RIDER_GENDERS).withMessage('Please choose a valid gender.'),

  text('address.residentialAddress', { min: 5, max: 300, label: 'Residential address', multiline: true }),
  text('address.city', { min: 2, max: 80, label: 'City' }),
  text('address.area', { min: 2, max: 120, label: 'Area / locality' }),
  body('address.pincode')
    .customSanitizer((v) => cleanText(v))
    .notEmpty().withMessage('Pincode is required.').bail()
    .matches(/^[1-9][0-9]{5}$/).withMessage('Please enter a valid 6-digit pincode.'),
  text('contactInformation.emergencyContactName', { max: 80, label: 'Emergency contact name', optional: true }),
  phoneRule('contactInformation.emergencyContactNumber', 'Emergency contact number', true),

  body('drivingInformation.licenceNumber')
    .customSanitizer((v) => cleanText(v).toUpperCase())
    .notEmpty().withMessage('Driving licence number is required.').bail()
    .matches(/^[A-Z0-9][A-Z0-9\s-]{3,39}$/).withMessage('Please enter a valid driving licence number.'),
  text('drivingInformation.experience', { min: 2, max: 60, label: 'Driving experience' }),

  body('vehicleInformation.ownsVehicle')
    .notEmpty().withMessage('Please tell us whether you own a vehicle.').bail()
    .isBoolean({ strict: false }).withMessage('Invalid vehicle ownership value.').bail()
    .toBoolean(),
  body('vehicleInformation.vehicleType')
    .optional({ values: 'falsy' })
    .isIn(RIDER_VEHICLE_TYPES).withMessage('Please choose a valid vehicle type.'),
  body('vehicleInformation.registrationNumber')
    .optional({ values: 'falsy' })
    .customSanitizer((v) => cleanText(v).toUpperCase())
    .matches(/^[A-Z0-9][A-Z0-9\s-]{3,29}$/).withMessage('Please enter a valid registration number.'),
  text('vehicleInformation.brand', { max: 60, label: 'Vehicle brand', optional: true }),
  text('vehicleInformation.model', { max: 60, label: 'Vehicle model', optional: true }),

  text('workPreferences.preferredWorkingArea', { min: 2, max: 160, label: 'Preferred working area' }),
  body('workPreferences.workType')
    .notEmpty().withMessage('Please choose a work type.').bail()
    .isIn(RIDER_WORK_TYPES).withMessage('Please choose a valid work type.'),
  text('workPreferences.preferredWorkingHours', { max: 120, label: 'Preferred working hours', optional: true }),
  body('workPreferences.availabilityDays')
    .optional({ values: 'falsy' })
    .isArray().withMessage('Please choose valid availability days.').bail()
    .custom((days) => days.every((day) => RIDER_AVAILABILITY_DAYS.includes(day)))
    .withMessage('Please choose valid availability days.'),

  body('identityVerification.aadhaarConsent').optional().isBoolean({ loose: true }).toBoolean(),
  body('identityVerification.aadhaarNumber').optional({ values: 'falsy' }).trim().matches(/^[0-9Xx\s-]{12,32}$/).withMessage('Please enter a valid Aadhaar number.'),
  body('identityVerification.panConsent').isBoolean({ loose: true }).toBoolean().custom((value) => value === true).withMessage('Please consent to PAN verification.'),
  body('identityVerification.panNumber').trim().customSanitizer((v) => cleanText(v).toUpperCase()).matches(/^[A-Z0-9]{10}$/).withMessage('Please enter a valid PAN number.'),
  text('identityVerification.additionalNotes', { max: 600, label: 'Additional verification notes', multiline: true, optional: true }),

  body('paymentInformation.submitted').notEmpty().isBoolean({ loose: true }).toBoolean(),
  body('paymentInformation.accountHolderName').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('paymentInformation.bankName').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('paymentInformation.accountNumber').optional({ values: 'falsy' }).trim().matches(/^[0-9]{6,18}$/).withMessage('Please enter a valid account number.'),
  body('paymentInformation.confirmAccountNumber')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value, { req }) => value === req.body.paymentInformation?.accountNumber)
    .withMessage('Account numbers do not match.'),
  body('paymentInformation.ifscCode').optional({ values: 'falsy' }).customSanitizer((v) => cleanText(v).toUpperCase()).matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Please enter a valid IFSC code.'),
  body('paymentInformation.upiId').optional({ values: 'falsy' }).trim().matches(/^[\w.\-]+@[\w.\-]+$/).withMessage('Please enter a valid UPI ID.'),

  body('consents.accurate').isBoolean({ loose: true }).equals('true').withMessage('Please confirm your information is accurate.'),
  body('consents.terms').isBoolean({ loose: true }).equals('true').withMessage('Please agree to the rider terms.'),
  body('consents.processing').isBoolean({ loose: true }).equals('true').withMessage('Please consent to processing your information.'),
  submissionKeyRule,
];

const riderStatusRules = [
  body('applicationId')
    .customSanitizer((v) => cleanText(v).toUpperCase())
    .notEmpty().withMessage('Application ID is required.').bail()
    .matches(/^RIDER-\d{8}-[A-Z0-9]{6}$/).withMessage('Please enter a valid application ID.'),
];

module.exports = { productRequestRules, contactRules, riderRegistrationRules, riderStatusRules };
