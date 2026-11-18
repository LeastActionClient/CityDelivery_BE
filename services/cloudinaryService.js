const cloudinary = require('../config/cloudinary');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Uploads an in-memory image buffer to Cloudinary.
 * Returns only the fields we store. `overwrite:false` + unique_filename keeps IDs unguessable.
 */
function uploadProductImage(buffer, requestId) {
  if (!env.cloudinaryConfigured) {
    throw new AppError(
      'Image uploads are temporarily unavailable. Please submit your request without an image, or try again later.',
      503,
      { productImage: 'Image uploads are unavailable right now.' }
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinary.folder,
        public_id: requestId,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        overwrite: false,
        unique_filename: true,
      },
      (err, result) => {
        if (err) {
          console.error('[cloudinary] upload failed:', err.message);
          return reject(
            new AppError('We could not upload your image. Please try again or submit without it.', 502, {
              productImage: 'Image upload failed.',
            })
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  if (!publicId || !env.cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn('[cloudinary] cleanup failed:', err.message);
  }
}

module.exports = { uploadProductImage, deleteImage };
