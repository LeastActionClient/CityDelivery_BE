const multer = require('multer');
const AppError = require('../utils/AppError');
const { MAX_IMAGE_BYTES, ALLOWED_DOCUMENT_MIME, FRANCHISE_DOCUMENT_KEYS } = require('../utils/constants');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 3, fields: 80, fieldSize: 20 * 1024, parts: 90 },
  fileFilter: (_req, file, cb) => {
    if (!FRANCHISE_DOCUMENT_KEYS.includes(file.fieldname)) {
      return cb(new AppError('One or more uploaded files are not recognised.', 422, { documents: 'Unexpected upload field.' }));
    }
    if (!ALLOWED_DOCUMENT_MIME.includes(file.mimetype)) {
      return cb(new AppError('Only JPG, PNG, WebP or PDF documents are allowed.', 422, { [file.fieldname]: 'Unsupported file type.' }));
    }
    cb(null, true);
  },
});

function hasValidSignature(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;
  if (mimeType === 'application/pdf') return buffer.slice(0, 5).toString('ascii') === '%PDF-';
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

function setNested(target, path, value) {
  const parts = path.split('.');
  if (parts.some((part) => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) return;
  if (parts.some((part) => /^\d+$/.test(part) && Number(part) > 99)) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const needsArray = /^\d+$/.test(nextPart);
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = needsArray ? [] : {};
    else if (needsArray && !Array.isArray(cursor[part])) cursor[part] = [];
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function expandFranchiseBody(req, _res, next) {
  const expanded = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    if (key.includes('.')) setNested(expanded, key, value);
    else expanded[key] = value;
  }
  req.body = expanded;
  next();
}

function verifyFranchiseDocuments(req, _res, next) {
  const files = req.files || [];
  const grouped = {};
  for (const file of files) {
    if (!hasValidSignature(file.buffer, file.mimetype)) {
      return next(new AppError('One or more documents are not valid files.', 422, { [file.fieldname]: 'Invalid file content.' }));
    }
    if (grouped[file.fieldname]) {
      return next(new AppError('Please upload only one file for each document.', 422, { [file.fieldname]: 'Only one file is allowed.' }));
    }
    grouped[file.fieldname] = file;
  }
  req.groupedDocuments = grouped;
  next();
}

module.exports = { uploadFranchiseDocuments: upload.any(), expandFranchiseBody, verifyFranchiseDocuments };
