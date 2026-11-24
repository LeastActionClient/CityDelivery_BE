const crypto = require('crypto');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

function missingConfig() {
  const missing = [];
  if (!env.cashfree.clientId) missing.push('CASHFREE_CLIENT_ID');
  if (!env.cashfree.clientSecret) missing.push('CASHFREE_CLIENT_SECRET');
  if (!['sandbox', 'production'].includes(env.cashfree.environment)) missing.push('CASHFREE_ENVIRONMENT (sandbox or production)');
  return missing;
}

function isConfigured() {
  return missingConfig().length === 0;
}

function assertConfigured() {
  const missing = missingConfig();
  if (missing.length) {
    throw new AppError(`Online payments are not configured yet. Missing: ${missing.join(', ')}.`, 503);
  }
}

function baseUrl() {
  return env.cashfree.environment === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
  assertConfigured();
  const headers = {
    'x-client-id': env.cashfree.clientId,
    'x-client-secret': env.cashfree.clientSecret,
    'x-api-version': env.cashfree.apiVersion,
    'x-request-id': crypto.randomUUID(),
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;

  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error('[cashfree] request failed:', err.message);
    throw new AppError('The payment provider could not be reached. Please try again.', 502);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON provider response */
  }

  if (!response.ok) {
    const message = data?.message || data?.error?.message || `Payment provider returned ${response.status}.`;
    console.error(`[cashfree] ${method} ${path} failed:`, message);
    throw new AppError(String(message).slice(0, 300), 502);
  }
  return data || {};
}

function createOrder({ orderId, amount, customer, returnUrl, notifyUrl }) {
  const body = {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: 'INR',
    customer_details: {
      customer_id: String(customer.customerId || orderId).slice(0, 60),
      customer_name: String(customer.name || 'Franchise Applicant').slice(0, 80),
      customer_email: String(customer.email || '').slice(0, 120),
      customer_phone: normalizePhone(customer.phone),
    },
    order_meta: {
      return_url: returnUrl,
    },
    order_note: 'City Delivery Services franchise initial payment',
    order_tags: {
      purpose: 'franchise_application_fee',
    },
  };
  if (notifyUrl) body.order_meta.notify_url = notifyUrl;
  return api('/orders', { method: 'POST', body, idempotencyKey: orderId });
}

function getOrder(orderId) {
  return api(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

function verifyWebhookSignature(rawBody, signature, timestamp) {
  assertConfigured();
  if (!signature || !timestamp || !rawBody) return false;
  const signedPayload = `${timestamp}${rawBody}`;
  const expected = crypto.createHmac('sha256', env.cashfree.clientSecret).update(signedPayload).digest('base64');
  const received = Buffer.from(String(signature));
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && crypto.timingSafeEqual(received, calculated);
}

function parseWebhookBody(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError('Invalid webhook payload.', 400);
  }
}

module.exports = {
  isConfigured,
  assertConfigured,
  getConfig: () => ({
    configured: isConfigured(),
    environment: env.cashfree.environment,
    apiVersion: env.cashfree.apiVersion,
    webhookConfigured: Boolean(env.cashfree.webhookUrl),
  }),
  createOrder,
  getOrder,
  verifyWebhookSignature,
  parseWebhookBody,
};
