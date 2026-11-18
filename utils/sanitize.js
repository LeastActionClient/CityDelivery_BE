/**
 * Text sanitisation helpers.
 *
 * - cleanText: strips control chars + HTML tags, collapses spaces, trims.
 * - hasMongoOperators: detects `$`-prefixed / dotted keys (NoSQL injection attempts).
 *
 * Output is additionally HTML-escaped wherever it is rendered (email templates, React),
 * so we never store pre-escaped entities.
 */
function cleanText(value, { multiline = false } = {}) {
  if (value === undefined || value === null) return '';
  let s = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '');
  if (multiline) {
    s = s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(/\s+/g, ' ');
  }
  return s.trim();
}

function hasMongoOperators(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some((k) => {
    if (k.startsWith('$') || k.includes('.')) return true;
    return hasMongoOperators(obj[k]);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { cleanText, hasMongoOperators, escapeHtml };
