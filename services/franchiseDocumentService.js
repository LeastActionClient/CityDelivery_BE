const cloudinary = require('../config/cloudinary');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

const FOLDER = (env.cloudinary.folder || 'city-delivery-services/requests').replace(/\/requests$/, '/franchises');

function assertConfigured() {
  if (!env.cloudinaryConfigured) {
    throw new AppError('Secure document storage is not configured. Please try again later.', 503);
  }
}

function publicIdFor(applicationId, field, index) {
  return `${FOLDER}/${applicationId}/${field}-${index}-${Date.now()}`;
}

function uploadDocument(buffer, { applicationId, field, index, mimeType, originalName }) {
  assertConfigured();
  const isPdf = mimeType === 'application/pdf';
  const publicId = publicIdFor(applicationId, field, index);
  const options = {
    public_id: publicId,
    folder: undefined,
    type: 'private',
    resource_type: isPdf ? 'raw' : 'image',
    overwrite: false,
    unique_filename: false,
    use_filename: false,
    context: `field=${field}|application=${applicationId}`,
  };
  if (!isPdf) {
    options.allowed_formats = ['jpg', 'jpeg', 'png', 'webp'];
    options.transformation = [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto' }];
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) {
        console.error('[cloudinary] franchise document upload failed:', err.message);
        return reject(new AppError('A document could not be uploaded. Please try again.', 502));
      }
      resolve({
        publicId: result.public_id,
        resourceType: isPdf ? 'raw' : 'image',
        format: isPdf ? 'pdf' : result.format,
        mimeType,
        bytes: result.bytes,
        originalName,
        uploadedAt: new Date(),
      });
    });
    stream.end(buffer);
  });
}

function documentUrl(documentRecord, { attachment = false, seconds = 600 } = {}) {
  assertConfigured();
  if (!documentRecord?.publicId) return null;
  return cloudinary.utils.private_download_url(documentRecord.publicId, documentRecord.format, {
    resource_type: documentRecord.resourceType === 'raw' ? 'raw' : 'image',
    type: 'private',
    attachment,
    expires_at: Math.floor(Date.now() / 1000) + seconds,
  });
}

async function deleteDocument(documentRecord) {
  if (!documentRecord?.publicId || !env.cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(documentRecord.publicId, {
      resource_type: documentRecord.resourceType === 'raw' ? 'raw' : 'image',
      type: 'private',
      invalidate: true,
    });
  } catch (err) {
    console.warn('[cloudinary] franchise document cleanup failed:', err.message);
  }
}

module.exports = { uploadDocument, documentUrl, deleteDocument };
