const CATEGORIES = [
  'Groceries',
  'Fashion & Apparel',
  'Electronics',
  'Home & Kitchen',
  'Health & Beauty',
  'Books & Stationery',
  'Gifts',
  'Documents',
  'Other',
];

const STATUSES = ['Pending', 'Reviewing', 'Contacted', 'Completed', 'Cancelled'];
const REQUEST_NEXT_STEPS = {
  Pending: 'Your request has been received. Our team will review it and contact you with the next steps.',
  Reviewing: 'Our team is reviewing your request. Please keep your Request ID handy for any follow-up.',
  Contacted: 'Our team has contacted you about this request. Check your email or phone for the latest update.',
  Completed: 'This request is complete. Contact us if you need anything else.',
  Cancelled: 'This request was cancelled. Contact us if you think this is a mistake.',
};
const NOTIFY_STATES = ['not_applicable', 'pending', 'sent', 'failed'];
const PROHIBITED_ITEMS_POLICY_VERSION = '2026-11-20';

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

const FRANCHISE_STATUSES = [
  'Payment Pending',
  'Payment Successful',
  'Under Review',
  'Approved',
  'Rejected',
  'Agreement Pending',
  'Active Franchise',
];
const FRANCHISE_PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const FRANCHISE_REFUND_POLICIES = ['Refundable', 'Non-refundable'];
const FRANCHISE_INVESTMENT_CAPACITIES = [
  'Below ₹1,00,000',
  '₹1,00,000 – ₹3,00,000',
  '₹3,00,000 – ₹5,00,000',
  'Above ₹5,00,000',
];
const FRANCHISE_DOCUMENT_KEYS = ['businessProof', 'addressProof', 'otherProof'];
const FRANCHISE_VEHICLE_TYPES = [
  'Bike',
  'Scooter',
  'Electric Bike',
  'Car',
  'Three Wheeler',
  'Pickup Van',
  'Delivery Van',
  'Lorry',
  'Other',
];
const FRANCHISE_ADMIN_ROLES = ['owner', 'franchise_manager', 'support'];

module.exports = {
  CATEGORIES,
  STATUSES,
  REQUEST_NEXT_STEPS,
  NOTIFY_STATES,
  PROHIBITED_ITEMS_POLICY_VERSION,
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
  FRANCHISE_STATUSES,
  FRANCHISE_PAYMENT_STATUSES,
  FRANCHISE_REFUND_POLICIES,
  FRANCHISE_INVESTMENT_CAPACITIES,
  FRANCHISE_DOCUMENT_KEYS,
  FRANCHISE_VEHICLE_TYPES,
  FRANCHISE_ADMIN_ROLES,
};
