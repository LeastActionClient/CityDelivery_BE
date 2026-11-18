const crypto = require('crypto');

// Crockford-style alphabet (no 0/O/1/I/L) so IDs are easy to read out over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** e.g. CDS-20261118-K7M2QX */
function generateRequestId(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `CDS-${y}${m}${d}-${randomChars(6)}`;
}

module.exports = { generateRequestId };
