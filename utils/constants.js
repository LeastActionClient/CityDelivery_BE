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
const NOTIFY_STATES = ['pending', 'sent', 'failed'];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = { CATEGORIES, STATUSES, NOTIFY_STATES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME };
