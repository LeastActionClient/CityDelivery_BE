const multer = require('multer');
const AppError = require('../utils/AppError');
const { MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME } = require('../utils/constants');

/**
 * Images are held in memory only (never written to the server disk) and streamed
 * straight to Cloudinary. Limits: 1 file, 5 MB, JPEG/PNG/WebP.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 30, fieldSize: 10 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return cb(new AppError('Only JPG, PNG or WebP images are allowed.', 422, { productImage: 'Unsupported image type.' }));
    }
    cb(null, true);
  },
});

/** The declared MIME type is client-controlled, so also verify the real file signature. */
function hasValidImageSignature(buf) {
  if (!buf || buf.length < 12) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

function verifyImage(req, _res, next) {
  if (req.file && !hasValidImageSignature(req.file.buffer)) {
    return next(new AppError('That file does not look like a valid image.', 422, { productImage: 'Invalid image file.' }));
  }
  next();
}

module.exports = { upload: upload.single('productImage'), verifyImage };
