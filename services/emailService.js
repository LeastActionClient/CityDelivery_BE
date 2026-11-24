const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const ProductRequest = require('../models/ProductRequest');
const ContactMessage = require('../models/ContactMessage');
const RiderApplication = require('../models/RiderApplication');
const FranchiseApplication = require('../models/FranchiseApplication');
const {
  ownerRequestEmail,
  customerConfirmationEmail,
  ownerContactEmail,
  ownerRiderApplicationEmail,
  riderSubmissionEmail,
  riderStatusUpdateEmail,
  ownerFranchiseApplicationEmail,
  franchiseSubmissionEmail,
  franchiseStatusUpdateEmail,
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
      await sendMail({ to: env.ownerEmail, replyTo: r.email || undefined, ...mail });
      r.ownerNotification.status = 'sent';
      r.ownerNotification.sentAt = new Date();
      r.ownerNotification.lastError = undefined;
    } catch (err) {
      r.ownerNotification.status = 'failed';
      r.ownerNotification.lastError = shortError(err);
      console.error(`[mail] owner notification failed for ${r.requestId}:`, shortError(err));
    }
  }

  if (!r.email) {
    r.customerNotification.status = 'sent';
  } else if (r.customerNotification.status !== 'sent') {
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

function riderStatusUrl() {
  return `${env.frontendUrl}/rider/status`;
}

async function notifyRiderApplication(doc) {
  const state = doc.notifications.submitted;
  state.attempts += 1;
  let failed = false;

  try {
    await sendMail({ to: env.ownerEmail, replyTo: doc.contactInformation?.email || undefined, ...ownerRiderApplicationEmail(doc) });
  } catch (err) {
    failed = true;
    console.error(`[mail] owner rider notification failed for ${doc.applicationId}:`, shortError(err));
  }

  if (doc.contactInformation?.email) {
    try {
      await sendMail({
        to: doc.contactInformation.email,
        replyTo: env.ownerEmail,
        ...riderSubmissionEmail(doc, riderStatusUrl()),
      });
    } catch (err) {
      failed = true;
      console.error(`[mail] rider confirmation failed for ${doc.applicationId}:`, shortError(err));
    }
  }

  state.status = failed ? 'failed' : 'sent';
  state.lastError = failed ? 'One or more rider emails failed.' : undefined;
  if (!failed) state.sentAt = new Date();
  await doc.save();
  return state.status;
}

const RIDER_UPDATE_MAIL = {
  approval: {
    heading: 'Rider Application Approved',
    preheader: 'Your rider application has been approved.',
    intro: 'Congratulations — your rider application has been approved. Our team will contact you with onboarding details.',
    ctaLabel: 'View your status',
  },
  rejection: {
    heading: 'Rider Application Update',
    preheader: 'An update on your rider application.',
    intro: 'Thank you for your interest in riding with City Delivery Services. After review, we are unable to move forward with this application.',
    ctaLabel: 'View your status',
  },
  documentsRequested: {
    heading: 'Additional Documents Requested',
    preheader: 'We need a few more documents for your rider application.',
    intro: 'Our team has requested additional information for your rider application. Please check the message below and contact us with the updated documents.',
    ctaLabel: 'View your status',
  },
  activation: {
    heading: 'Rider Account Activated',
    preheader: 'Your rider account is now active.',
    intro: 'Your rider account has been activated. Delivery assignments and related tools will be available through the dedicated rider app when enabled.',
    ctaLabel: 'View your status',
  },
};

async function notifyRiderUpdate(doc, type) {
  const config = RIDER_UPDATE_MAIL[type];
  if (!config) return null;
  const state = doc.notifications[type];
  state.attempts += 1;
  const to = doc.contactInformation?.email;
  if (!to) {
    state.status = 'sent';
    state.lastError = undefined;
    await doc.save();
    return state.status;
  }

  const note = type === 'rejection'
    ? doc.rejectionReason
    : type === 'documentsRequested'
      ? doc.additionalDocumentRequest?.message
      : '';

  try {
    await sendMail({
      to,
      replyTo: env.ownerEmail,
      ...riderStatusUpdateEmail(doc, { ...config, note, statusUrl: riderStatusUrl() }),
    });
    state.status = 'sent';
    state.sentAt = new Date();
    state.lastError = undefined;
  } catch (err) {
    state.status = 'failed';
    state.lastError = shortError(err);
    console.error(`[mail] rider ${type} notification failed for ${doc.applicationId}:`, shortError(err));
  }
  await doc.save();
  return state.status;
}

function franchiseStatusUrl() {
  return `${env.frontendUrl}/franchise/status`;
}

async function notifyFranchiseApplication(doc) {
  const state = doc.notifications.submitted;
  state.attempts += 1;
  let failed = false;

  try {
    await sendMail({
      to: env.ownerEmail,
      replyTo: doc.email || undefined,
      ...ownerFranchiseApplicationEmail(doc),
    });
  } catch (err) {
    failed = true;
    console.error(`[mail] owner franchise notification failed for ${doc.applicationId}:`, shortError(err));
  }

  if (doc.email) {
    try {
      await sendMail({
        to: doc.email,
        replyTo: env.ownerEmail,
        ...franchiseSubmissionEmail(doc, franchiseStatusUrl()),
      });
    } catch (err) {
      failed = true;
      console.error(`[mail] franchise confirmation failed for ${doc.applicationId}:`, shortError(err));
    }
  }

  state.status = failed ? 'failed' : 'sent';
  state.lastError = failed ? 'One or more franchise emails failed.' : undefined;
  if (!failed) state.sentAt = new Date();
  await doc.save();
  return state.status;
}

const FRANCHISE_UPDATE_MAIL = {
  paymentSuccess: {
    heading: 'Franchise Application Fee Received',
    preheader: 'Your franchise initial payment was successful.',
    intro: 'We have recorded your franchise initial payment. Your application will now be reviewed.',
    ctaLabel: 'View your status',
  },
  underReview: {
    heading: 'Franchise Application Under Review',
    preheader: 'Your franchise application is being reviewed.',
    intro: 'Our team is reviewing your franchise application. No action is needed right now.',
    ctaLabel: 'View your status',
  },
  approved: {
    heading: 'Franchise Application Approved',
    preheader: 'Your franchise application has been approved.',
    intro: 'Your franchise application has been approved. Our team will contact you with agreement and onboarding details.',
    ctaLabel: 'View your status',
  },
  rejected: {
    heading: 'Franchise Application Update',
    preheader: 'An update on your franchise application.',
    intro: 'Thank you for your interest in becoming a franchise partner. After review, we are unable to move forward with this application.',
    ctaLabel: 'View your status',
  },
  additionalInfoRequested: {
    heading: 'More Information Requested',
    preheader: 'We need more information for your franchise application.',
    intro: 'Our team has requested more information for your franchise application. Please check the message below and contact us with the details.',
    ctaLabel: 'View your status',
  },
  agreementPending: {
    heading: 'Franchise Agreement Pending',
    preheader: 'Your franchise agreement steps are being prepared.',
    intro: 'Your application is approved and the agreement steps are being prepared. Our team will contact you with the next instructions.',
    ctaLabel: 'View your status',
  },
  activated: {
    heading: 'Franchise Activated',
    preheader: 'Your franchise is now active.',
    intro: 'Your franchise has been activated. Our team will contact you with operating details.',
    ctaLabel: 'View your status',
  },
};

async function notifyFranchiseUpdate(doc, type) {
  const config = FRANCHISE_UPDATE_MAIL[type];
  if (!config) return null;
  const state = doc.notifications?.[type];
  if (!state) return null;
  state.attempts += 1;
  const to = doc.email;
  if (!to) {
    state.status = 'sent';
    state.lastError = undefined;
    await doc.save();
    return state.status;
  }

  const note = type === 'rejected'
    ? doc.rejectionReason
    : type === 'additionalInfoRequested'
      ? doc.infoRequest?.message
      : '';

  try {
    await sendMail({
      to,
      replyTo: env.ownerEmail,
      ...franchiseStatusUpdateEmail(doc, { ...config, note, statusUrl: franchiseStatusUrl() }),
    });
    state.status = 'sent';
    state.sentAt = new Date();
    state.lastError = undefined;
  } catch (err) {
    state.status = 'failed';
    state.lastError = shortError(err);
    console.error(`[mail] franchise ${type} notification failed for ${doc.applicationId}:`, shortError(err));
  }
  await doc.save();
  return state.status;
}

function franchiseUpdateDue(doc, key) {
  const state = doc.notifications?.[key];
  if (!state || state.status === 'sent' || state.status === 'not_applicable') return false;
  if (key === 'paymentSuccess') return doc.payment?.status === 'PAID';
  if (key === 'underReview') return doc.applicationStatus === 'Under Review';
  if (key === 'approved') return doc.applicationStatus === 'Approved' || Boolean(doc.approvedAt);
  if (key === 'rejected') return doc.applicationStatus === 'Rejected' || Boolean(doc.rejectionReason);
  if (key === 'additionalInfoRequested') return Boolean(doc.infoRequest?.message);
  if (key === 'agreementPending') return doc.applicationStatus === 'Agreement Pending';
  if (key === 'activated') return doc.applicationStatus === 'Active Franchise' || Boolean(doc.activatedAt);
  return false;
}

async function archiveInapplicableRiderNotifications() {
  const jobs = [
    ['approval', { approvedAt: { $exists: false }, applicationStatus: { $ne: 'Approved' } }],
    ['rejection', { rejectionReason: { $in: [null, ''] }, applicationStatus: { $ne: 'Rejected' } }],
    ['documentsRequested', { 'additionalDocumentRequest.message': { $in: [null, ''] }, applicationStatus: { $ne: 'Additional Documents Required' } }],
    ['activation', { active: false, activatedAt: { $exists: false } }],
  ];
  for (const [key, condition] of jobs) {
    await RiderApplication.updateMany(
      {
        $and: [
          { [`notifications.${key}.status`]: 'pending' },
          { [`notifications.${key}.attempts`]: 0 },
          condition,
        ],
      },
      { $set: { [`notifications.${key}.status`]: 'not_applicable' } }
    ).setOptions({ sanitizeFilter: false });
  }
}

function riderUpdateDue(doc, key) {
  const state = doc.notifications?.[key];
  if (!state || state.status === 'sent' || state.status === 'not_applicable') return false;
  if (key === 'approval') return doc.applicationStatus === 'Approved' || Boolean(doc.approvedAt);
  if (key === 'rejection') return doc.applicationStatus === 'Rejected' || Boolean(doc.rejectionReason);
  if (key === 'documentsRequested') return doc.applicationStatus === 'Additional Documents Required' || Boolean(doc.additionalDocumentRequest?.message);
  if (key === 'activation') return Boolean(doc.active) || Boolean(doc.activatedAt);
  return false;
}

/** Background worker: retries unsent notifications with a capped number of attempts. */
let retrying = false;
async function retryPendingNotifications() {
  if (retrying || !env.smtpConfigured) return;
  retrying = true;
  try {
    await archiveInapplicableRiderNotifications();
    const max = env.notify.maxAttempts;
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const requests = await ProductRequest.find({
      createdAt: { $gte: since },
      $or: [
        { 'ownerNotification.status': { $ne: 'sent' }, 'ownerNotification.attempts': { $lt: max } },
        { 'customerNotification.status': { $ne: 'sent' }, 'customerNotification.attempts': { $lt: max } },
      ],
    }).setOptions({ sanitizeFilter: false }).limit(25);
    for (const r of requests) await notifyRequest(r);

    const contacts = await ContactMessage.find({
      createdAt: { $gte: since },
      'notification.status': { $ne: 'sent' },
      'notification.attempts': { $lt: max },
    }).setOptions({ sanitizeFilter: false }).limit(25);
    for (const c of contacts) await notifyContact(c);

    const riderKeys = ['submitted', 'approval', 'rejection', 'documentsRequested', 'activation'];
    const riderOr = riderKeys.map((key) => ({
      $and: [
        { [`notifications.${key}.status`]: { $in: ['pending', 'failed'] } },
        { [`notifications.${key}.attempts`]: { $lt: max } },
      ],
    }));
    const riders = await RiderApplication.find({
      createdAt: { $gte: since },
      $or: riderOr,
    }).setOptions({ sanitizeFilter: false }).limit(25);
    for (const r of riders) {
      const submitted = r.notifications.submitted;
      if (submitted.status !== 'sent' && submitted.status !== 'not_applicable' && submitted.attempts < max) {
        await notifyRiderApplication(r);
      }
      for (const key of riderKeys.slice(1)) {
        if (riderUpdateDue(r, key) && r.notifications[key].attempts < max) await notifyRiderUpdate(r, key);
      }
    }

    const franchiseKeys = [
      'submitted',
      'paymentSuccess',
      'underReview',
      'approved',
      'rejected',
      'additionalInfoRequested',
      'agreementPending',
      'activated',
    ];
    const franchiseOr = franchiseKeys.map((key) => ({
      $and: [
        { [`notifications.${key}.status`]: { $in: ['pending', 'failed'] } },
        { [`notifications.${key}.attempts`]: { $lt: max } },
      ],
    }));
    const franchises = await FranchiseApplication.find({
      createdAt: { $gte: since },
      $or: franchiseOr,
    }).setOptions({ sanitizeFilter: false }).limit(25);
    for (const f of franchises) {
      if (f.notifications.submitted.status !== 'sent' && f.notifications.submitted.attempts < max) {
        await notifyFranchiseApplication(f);
      }
      for (const key of franchiseKeys.slice(1)) {
        if (franchiseUpdateDue(f, key) && f.notifications[key].attempts < max) await notifyFranchiseUpdate(f, key);
      }
    }

    if (requests.length || contacts.length || riders.length || franchises.length) {
      console.log(`[mail] retry pass: ${requests.length} request(s), ${contacts.length} contact message(s), ${riders.length} rider application(s), ${franchises.length} franchise application(s)`);
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

module.exports = {
  notifyRequest,
  notifyContact,
  notifyRiderApplication,
  notifyRiderUpdate,
  riderUpdateDue,
  notifyFranchiseApplication,
  notifyFranchiseUpdate,
  franchiseUpdateDue,
  retryPendingNotifications,
  startRetryWorker,
};
