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

function generateRiderApplicationId(date = new Date()) {
  return `RIDER-${datePart(date)}-${randomChars(6)}`;
}

function generateRiderId(date = new Date()) {
  return `CDSR-${datePart(date)}-${randomChars(6)}`;
}

module.exports = { generateRiderApplicationId, generateRiderId };
