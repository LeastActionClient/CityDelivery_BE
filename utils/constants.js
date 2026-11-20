const CATEGORIES = [
  'Groceries',
  'Fashion & Apparel',
  'Electronics',
  'Home & Kitchen',
  'Health & Beauty',
  'Books & Stationery',
  'Gifts',
  'Other',
];

const STATUSES = ['Pending', 'Reviewing', 'Contacted', 'Completed', 'Cancelled'];
const NOTIFY_STATES = ['not_applicable', 'pending', 'sent', 'failed'];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const RIDER_STATUSES = [
  'Submitted',
  'Under Review',
  'Additional Documents Required',
  'Approved',
  'Rejected',
  'Inactive',
];
const RIDER_WORK_TYPES = ['Full Time', 'Part Time', 'Flexible'];
const RIDER_VEHICLE_TYPES = ['Motorcycle', 'Scooter', 'Electric Bike', 'Three Wheeler', 'Mini Truck'];
const RIDER_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const RIDER_AVAILABILITY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RIDER_DOCUMENT_KEYS = [
  'profilePhoto',
  'licenceFront',
  'licenceBack',
  'vehicleRcFront',
  'vehicleRcBack',
  'insuranceDocument',
  'vehiclePhoto',
  'aadhaarDocument',
  'panDocument',
  'additionalDocument1',
  'additionalDocument2',
  'cancelledCheque',
];
const RIDER_PUBLIC_DOCUMENT_KEYS = [
  'profilePhoto',
  'licenceFront',
  'licenceBack',
  'vehicleRcFront',
  'vehicleRcBack',
  'insuranceDocument',
  'vehiclePhoto',
];
const RIDER_SENSITIVE_DOCUMENT_KEYS = [
  'aadhaarDocument',
  'panDocument',
  'additionalDocument1',
  'additionalDocument2',
  'cancelledCheque',
];
const ALLOWED_DOCUMENT_MIME = [...ALLOWED_IMAGE_MIME, 'application/pdf'];

module.exports = {
  CATEGORIES,
  STATUSES,
  NOTIFY_STATES,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_MIME,
  RIDER_STATUSES,
  RIDER_WORK_TYPES,
  RIDER_VEHICLE_TYPES,
  RIDER_GENDERS,
  RIDER_AVAILABILITY_DAYS,
  RIDER_DOCUMENT_KEYS,
  RIDER_PUBLIC_DOCUMENT_KEYS,
  RIDER_SENSITIVE_DOCUMENT_KEYS,
  ALLOWED_DOCUMENT_MIME,
};
