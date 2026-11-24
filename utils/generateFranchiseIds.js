const crypto = require('crypto');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function datePart(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function generateFranchiseApplicationId(date = new Date()) {
  return `FRANCH-${datePart(date)}-${randomChars(6)}`;
}

function generateFranchiseId(date = new Date()) {
  return `CDSF-${datePart(date)}-${randomChars(6)}`;
}

function generateFranchiseOrderId(applicationId, attempt) {
  const safeId = String(applicationId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);
  return `FRANCHISE_${safeId}_${Number(attempt) || 1}`;
}

module.exports = { generateFranchiseApplicationId, generateFranchiseId, generateFranchiseOrderId };
