const required = ['MONGO_URI'];
const configuredFrontendOrigins = [process.env.FRONTEND_URL, process.env.VERCEL_FRONTEND_URL]
  .filter(Boolean)
  .flatMap((value) => value.split(','));

const defaultFrontendOrigins = [
  'http://localhost:5173',
  'https://citydeliveryservices.com',
  'https://www.citydeliveryservices.com',
];

const normalizeOrigin = (value) => String(value).trim().replace(/\/+$/, '').toLowerCase();
const primaryFrontendUrl = [process.env.FRONTEND_URL, process.env.VERCEL_FRONTEND_URL]
  .flatMap((value) => String(value || '').split(','))
  .find(Boolean) || 'https://www.citydeliveryservices.com';

const frontendOrigins = [
  ...new Set([...defaultFrontendOrigins, ...configuredFrontendOrigins].map(normalizeOrigin).filter(Boolean)),
];

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  trustProxy: process.env.TRUST_PROXY || '0',
  mongoUri: process.env.MONGO_URI,
  frontendUrl: normalizeOrigin(primaryFrontendUrl),
  frontendOrigins,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  ownerEmail: process.env.OWNER_EMAIL,
  fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'city-delivery-services/requests',
  },
  adminApiKey: process.env.ADMIN_API_KEY,
  riderSensitiveApiKey: process.env.RIDER_SENSITIVE_API_KEY,
  franchise: {
    defaultAdminRole: (process.env.FRANCHISE_ADMIN_DEFAULT_ROLE || 'owner').toLowerCase(),
  },
  notify: {
    intervalMinutes: Number(process.env.NOTIFY_RETRY_INTERVAL_MINUTES) || 5,
    maxAttempts: Number(process.env.NOTIFY_MAX_ATTEMPTS) || 5,
  },
};

env.smtpConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.ownerEmail);
env.cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

function assertEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (!env.smtpConfigured) {
    console.warn('[config] SMTP is not fully configured — emails will be marked as failed and retried later.');
  }
  if (!env.cloudinaryConfigured) {
    console.warn('[config] Cloudinary is not configured — requests with images will be rejected until it is.');
  }
  if (!env.adminApiKey) {
    console.warn('[config] ADMIN_API_KEY is not set — admin endpoints are disabled.');
  }
  if (!env.riderSensitiveApiKey) {
    console.warn('[config] RIDER_SENSITIVE_API_KEY is not set — rider bank, identity and document endpoints are disabled.');
  }
}

module.exports = { env, assertEnv };
