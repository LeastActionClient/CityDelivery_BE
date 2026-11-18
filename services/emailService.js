const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const ProductRequest = require('../models/ProductRequest');
const ContactMessage = require('../models/ContactMessage');
const {
  ownerRequestEmail,
  customerConfirmationEmail,
  ownerContactEmail,
} = require('../templates/emailTemplates');

let transporter;
function getTransporter() {
  if (!env.smtpConfigured) throw new Error('SMTP is not configured');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text, replyTo }) {
  return getTransporter().sendMail({ from: env.fromEmail, to, subject, html, text, replyTo });
}

const shortError = (err) => String(err?.message || err).slice(0, 300);

/**
 * Attempts every notification for a request that has not been sent yet and records
 * the outcome on the document. Never throws: failures are stored and retried later
 * by the retry worker or the admin retry endpoint.
 */
async function notifyRequest(requestDoc) {
  const r = requestDoc;
  const now = new Date();

  if (r.ownerNotification.status !== 'sent') {
    r.ownerNotification.attempts += 1;
    r.ownerNotification.lastAttemptAt = now;
    try {
      const mail = ownerRequestEmail(r);
      await sendMail({ to: env.ownerEmail, replyTo: r.email, ...mail });
      r.ownerNotification.status = 'sent';
      r.ownerNotification.sentAt = new Date();
      r.ownerNotification.lastError = undefined;
    } catch (err) {
      r.ownerNotification.status = 'failed';
      r.ownerNotification.lastError = shortError(err);
      console.error(`[mail] owner notification failed for ${r.requestId}:`, shortError(err));
    }
  }

  if (r.customerNotification.status !== 'sent') {
    r.customerNotification.attempts += 1;
    r.customerNotification.lastAttemptAt = now;
    try {
      const mail = customerConfirmationEmail(r);
      await sendMail({ to: r.email, replyTo: env.ownerEmail, ...mail });
      r.customerNotification.status = 'sent';
      r.customerNotification.sentAt = new Date();
      r.customerNotification.lastError = undefined;
    } catch (err) {
      r.customerNotification.status = 'failed';
      r.customerNotification.lastError = shortError(err);
      console.error(`[mail] customer confirmation failed for ${r.requestId}:`, shortError(err));
    }
  }

  await r.save();
  return {
    owner: r.ownerNotification.status,
    customer: r.customerNotification.status,
  };
}

async function notifyContact(msgDoc) {
  msgDoc.notification.attempts += 1;
  try {
    await sendMail({ to: env.ownerEmail, replyTo: msgDoc.email, ...ownerContactEmail(msgDoc) });
    msgDoc.notification.status = 'sent';
    msgDoc.notification.lastError = undefined;
  } catch (err) {
    msgDoc.notification.status = 'failed';
    msgDoc.notification.lastError = shortError(err);
    console.error('[mail] contact notification failed:', shortError(err));
  }
  await msgDoc.save();
  return msgDoc.notification.status;
}

/** Background worker: retries unsent notifications with a capped number of attempts. */
let retrying = false;
async function retryPendingNotifications() {
  if (retrying || !env.smtpConfigured) return;
  retrying = true;
  try {
    const max = env.notify.maxAttempts;
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const requests = await ProductRequest.find({
      createdAt: { $gte: since },
      $or: [
        { 'ownerNotification.status': { $ne: 'sent' }, 'ownerNotification.attempts': { $lt: max } },
        { 'customerNotification.status': { $ne: 'sent' }, 'customerNotification.attempts': { $lt: max } },
      ],
    }).limit(25);
    for (const r of requests) await notifyRequest(r);

    const contacts = await ContactMessage.find({
      createdAt: { $gte: since },
      'notification.status': { $ne: 'sent' },
      'notification.attempts': { $lt: max },
    }).limit(25);
    for (const c of contacts) await notifyContact(c);

    if (requests.length || contacts.length) {
      console.log(`[mail] retry pass: ${requests.length} request(s), ${contacts.length} contact message(s)`);
    }
  } catch (err) {
    console.error('[mail] retry worker error:', shortError(err));
  } finally {
    retrying = false;
  }
}

function startRetryWorker() {
  const ms = env.notify.intervalMinutes * 60 * 1000;
  const timer = setInterval(retryPendingNotifications, ms);
  timer.unref();
  return timer;
}

module.exports = { notifyRequest, notifyContact, retryPendingNotifications, startRetryWorker };
