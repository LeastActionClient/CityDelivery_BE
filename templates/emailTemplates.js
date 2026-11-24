const { escapeHtml: esc } = require('../utils/sanitize');

const BRAND = {
  yellow: '#FFC928',
  yellowSoft: '#FFE58A',
  green: '#168447',
  dark: '#111713',
  text: '#17221A',
  muted: '#747B72',
  bg: '#FFFDF5',
};

function formatDate(d) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(d)) + ' IST';
}

function row(label, value, { multiline = false } = {}) {
  const v = value === undefined || value === null || value === '' ? '<span style="color:#9aa39a">—</span>' : esc(value);
  return `
  <tr>
    <td style="padding:10px 0;width:38%;vertical-align:top;font-size:13px;color:${BRAND.muted};border-bottom:1px solid #f1ecd6;">${esc(label)}</td>
    <td style="padding:10px 0;vertical-align:top;font-size:14px;color:${BRAND.text};font-weight:600;border-bottom:1px solid #f1ecd6;${multiline ? 'white-space:pre-wrap;' : ''}">${v}</td>
  </tr>`;
}

function section(title, rows) {
  return `
  <tr><td style="padding:22px 0 6px;">
    <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:800;color:${BRAND.green};">${esc(title)}</div>
  </td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function layout({ preheader, heading, intro, body, footer }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f1e4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1e4;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:${BRAND.bg};border-radius:22px;overflow:hidden;box-shadow:0 10px 40px rgba(17,23,19,.12);">
    <tr><td style="background:${BRAND.dark};padding:26px 32px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.3px;">
          <span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:${BRAND.yellow};color:${BRAND.dark};border-radius:9px;margin-right:10px;font-weight:900;">C</span>City Delivery Services
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background:linear-gradient(135deg,${BRAND.yellow},${BRAND.yellowSoft});background-color:${BRAND.yellow};padding:30px 32px;">
      <div style="font-size:26px;line-height:1.2;font-weight:800;color:${BRAND.dark};">${esc(heading)}</div>
      <div style="margin-top:8px;font-size:14px;color:${BRAND.text};">${intro}</div>
    </td></tr>
    <tr><td style="padding:8px 32px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
    </td></tr>
    <tr><td style="padding:20px 32px 28px;background:#fff;border-top:1px solid #f1ecd6;font-size:12px;color:${BRAND.muted};line-height:1.6;">${footer}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

function ownerRequestEmail(r) {
  const budget = r.estimatedBudget != null ? `₹${Number(r.estimatedBudget).toLocaleString('en-IN')}` : '';
  const image = r.productImage?.url
    ? `<tr><td style="padding:18px 0 0;">
         <div style="font-size:12px;color:${BRAND.muted};margin-bottom:8px;">Reference image</div>
         <a href="${esc(r.productImage.url)}"><img src="${esc(r.productImage.url)}" alt="Product reference" width="280" style="max-width:100%;border-radius:14px;border:1px solid #f1ecd6;display:block;"></a>
       </td></tr>`
    : '';

  const body =
    `<tr><td style="padding-top:20px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:14px;padding:9px 16px;border-radius:999px;letter-spacing:.5px;">Request ID: ${esc(r.requestId)}</span>
       <span style="display:inline-block;margin-left:8px;font-size:13px;color:${BRAND.muted};">${esc(formatDate(r.createdAt))}</span>
     </td></tr>` +
    section(
      'Customer',
      row('Name', r.customerName) + row('Email', r.email) + row('Mobile number', r.phone)
    ) +
    section(
      'Product',
      row('Product name', r.productName) +
        row('Category', r.productCategory) +
        row('Store name', r.storeName) +
        row('Store location', r.storeLocation) +
        row('Quantity', r.quantity) +
        row('Estimated budget', budget) +
        row('Description', r.productDescription, { multiline: true })
    ) +
    image +
    section(
      'Delivery',
      row('Address', r.deliveryAddress, { multiline: true }) +
        row('City', r.city) +
        row('Postal code', r.postalCode) +
        row('Additional instructions', r.additionalInstructions, { multiline: true })
    ) +
    (r.email ? `<tr><td style="padding-top:24px;">
       <a href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Your product request ' + r.requestId)}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:12px;">Reply to customer</a>
     </td></tr>` : '');

  return {
    subject: `New Product Request - City Delivery Services (#${r.requestId})`,
    html: layout({
      preheader: `${r.customerName} requested ${r.productName} from ${r.storeName}`,
      heading: 'New product request',
      intro: `A customer just submitted a request through the website.`,
      body,
      footer: 'You are receiving this because this address is configured as OWNER_EMAIL for City Delivery Services.',
    }),
    text: [
      `New product request (#${r.requestId})`,
      `Submitted: ${formatDate(r.createdAt)}`,
      '',
      `CUSTOMER`,
      `Name: ${r.customerName}`,
      `Email: ${r.email}`,
      `Mobile: ${r.phone}`,
      '',
      `PRODUCT`,
      `Product: ${r.productName}`,
      `Category: ${r.productCategory}`,
      `Store: ${r.storeName}`,
      `Store location: ${r.storeLocation}`,
      `Quantity: ${r.quantity}`,
      `Estimated budget: ${budget || '—'}`,
      `Description: ${r.productDescription}`,
      r.productImage?.url ? `Image: ${r.productImage.url}` : '',
      '',
      `DELIVERY`,
      `Address: ${r.deliveryAddress}`,
      `City: ${r.city}`,
      `Postal code: ${r.postalCode}`,
      `Additional instructions: ${r.additionalInstructions || '—'}`,
    ]
      .filter((l) => l !== null)
      .join('\n'),
  };
}

function customerConfirmationEmail(r) {
  const body =
    `<tr><td style="padding-top:22px;font-size:15px;line-height:1.65;color:${BRAND.text};">
       Hi ${esc(r.customerName)},<br><br>
       Thank you — we have received your product request. Our team will review it and contact you with the next steps.
     </td></tr>
     <tr><td style="padding-top:18px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;letter-spacing:.5px;">Request ID: ${esc(r.requestId)}</span>
     </td></tr>` +
    section('Your request', row('Product', r.productName) + row('Store', r.storeName) + row('Quantity', r.quantity)) +
    `<tr><td style="padding-top:22px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
       Please keep your Request ID handy and mention it if you contact us. This email confirms receipt only — it is not a guarantee of availability, price or delivery time.
     </td></tr>`;

  return {
    subject: 'Your Product Request Has Been Received - City Delivery Services',
    html: layout({
      preheader: `We received your request for ${r.productName}.`,
      heading: 'We got your request',
      intro: 'Sit tight — our team will be in touch.',
      body,
      footer: 'You are receiving this email because a product request was submitted with your email address. If this was not you, you can ignore this message.',
    }),
    text: `Hi ${r.customerName},\n\nWe have received your product request.\n\nRequest ID: ${r.requestId}\nProduct: ${r.productName}\nStore: ${r.storeName}\n\nOur team will contact you with the next steps.\n\n— City Delivery Services`,
  };
}

function ownerContactEmail(m) {
  const body =
    section('Sender', row('Name', m.name) + row('Email', m.email)) +
    section('Message', row('Subject', m.subject) + row('Message', m.message, { multiline: true })) +
    `<tr><td style="padding-top:24px;">
       <a href="mailto:${esc(m.email)}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:12px;">Reply</a>
     </td></tr>`;
  return {
    subject: `New Contact Message - City Delivery Services${m.subject ? ` (${m.subject})` : ''}`.slice(0, 200),
    html: layout({
      preheader: `Message from ${m.name}`,
      heading: 'New contact message',
      intro: formatDate(m.createdAt),
      body,
      footer: 'Sent from the City Delivery Services contact form.',
    }),
    text: `New contact message\nFrom: ${m.name} <${m.email}>\nSubject: ${m.subject || '—'}\n\n${m.message}`,
  };
}

function statusButton(statusUrl, label = 'Check application status') {
  if (!statusUrl) return '';
  return `<tr><td style="padding-top:24px;">
     <a href="${esc(statusUrl)}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:12px;">${esc(label)}</a>
   </td></tr>`;
}

function ownerRiderApplicationEmail(r) {
  const body =
    `<tr><td style="padding-top:20px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:14px;padding:9px 16px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
       <span style="display:inline-block;margin-left:8px;font-size:13px;color:${BRAND.muted};">${esc(formatDate(r.createdAt))}</span>
     </td></tr>` +
    section(
      'Applicant',
      row('Full name', r.personalInformation?.fullName) +
        row('Mobile number', r.contactInformation?.mobile) +
        row('Email', r.contactInformation?.email) +
        row('Area', r.address?.area) +
        row('City', r.address?.city) +
        row('Pincode', r.address?.pincode)
    ) +
    section(
      'Rider details',
      row('Vehicle ownership', r.vehicleInformation?.ownsVehicle ? 'Own vehicle' : 'Needs assistance') +
        row('Vehicle type', r.vehicleInformation?.vehicleType) +
        row('Driving experience', r.drivingInformation?.experience) +
        row('Preferred working area', r.workPreferences?.preferredWorkingArea) +
        row('Work type', r.workPreferences?.workType) +
        row('Preferred hours', r.workPreferences?.preferredWorkingHours) +
        row('Documents uploaded', `${(r.uploadedDocuments && Object.keys(r.uploadedDocuments).length) || 0} file(s)`)
    ) +
    `<tr><td style="padding-top:22px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
       Bank, identity and document details are intentionally omitted from this email. Review them in the secure admin dashboard.
     </td></tr>`;

  return {
    subject: `New Rider Application - City Delivery Services (#${r.applicationId})`,
    html: layout({
      preheader: `${r.personalInformation?.fullName} applied to become a rider.`,
      heading: 'New rider application',
      intro: 'A new rider application was submitted through the website.',
      body,
      footer: 'You are receiving this because this address is configured as OWNER_EMAIL for City Delivery Services.',
    }),
    text: [
      `New rider application (#${r.applicationId})`,
      `Submitted: ${formatDate(r.createdAt)}`,
      '',
      `Name: ${r.personalInformation?.fullName}`,
      `Mobile: ${r.contactInformation?.mobile}`,
      `Email: ${r.contactInformation?.email || '—'}`,
      `Area: ${r.address?.area}, ${r.address?.city} - ${r.address?.pincode}`,
      `Vehicle: ${r.vehicleInformation?.vehicleType || 'Not specified'}`,
      `Preferred area: ${r.workPreferences?.preferredWorkingArea}`,
      `Work type: ${r.workPreferences?.workType}`,
      `Documents uploaded: ${(r.uploadedDocuments && Object.keys(r.uploadedDocuments).length) || 0}`,
      '',
      'Review bank, identity and document details in the secure admin dashboard.',
    ].join('\n'),
  };
}

function riderSubmissionEmail(r, statusUrl) {
  const body =
    `<tr><td style="padding-top:22px;font-size:15px;line-height:1.65;color:${BRAND.text};">
       Hi ${esc(r.personalInformation?.fullName)},<br><br>
       Thank you for your interest in riding with City Delivery Services. We have received your application and documents. Our team will review them and contact you about the next steps.
     </td></tr>
     <tr><td style="padding-top:18px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
     </td></tr>` +
    section(
      'Your application',
      row('Vehicle type', r.vehicleInformation?.vehicleType) +
        row('Preferred working area', r.workPreferences?.preferredWorkingArea) +
        row('Work type', r.workPreferences?.workType) +
        row('Current status', r.applicationStatus) +
        row('Submitted', formatDate(r.createdAt))
    ) +
    `<tr><td style="padding-top:22px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
       Please keep your Application ID handy. This email confirms receipt only — it is not approval, an offer of work, or a guarantee of deliveries or income.
     </td></tr>` +
    statusButton(statusUrl);

  return {
    subject: 'Your Rider Application Has Been Received - City Delivery Services',
    html: layout({
      preheader: `Your rider application ID is ${r.applicationId}.`,
      heading: 'Application received',
      intro: 'We are reviewing your details.',
      body,
      footer: 'You are receiving this email because a rider application was submitted with this email address. If this was not you, you can ignore this message.',
    }),
    text: `Hi ${r.personalInformation?.fullName},\n\nWe have received your rider application.\n\nApplication ID: ${r.applicationId}\nStatus: ${r.applicationStatus}\nVehicle: ${r.vehicleInformation?.vehicleType || 'Not specified'}\nPreferred area: ${r.workPreferences?.preferredWorkingArea}\n\nCheck status: ${statusUrl || '—'}\n\nThis confirms receipt only — it is not approval or an offer of work.\n\n— City Delivery Services`,
  };
}

function riderStatusUpdateEmail(r, { heading, preheader, intro, note, statusUrl, ctaLabel = 'Check application status' }) {
  const body =
    `<tr><td style="padding-top:22px;font-size:15px;line-height:1.65;color:${BRAND.text};">
       Hi ${esc(r.personalInformation?.fullName)},<br><br>${intro}
     </td></tr>
     <tr><td style="padding-top:18px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
     </td></tr>` +
    section('Current status', row('Status', r.applicationStatus) + (r.riderId ? row('Rider ID', r.riderId) : '')) +
    (note ? `<tr><td style="padding-top:20px;font-size:14px;line-height:1.65;color:${BRAND.text};white-space:pre-wrap;">${esc(note)}</td></tr>` : '') +
    statusButton(statusUrl, ctaLabel);

  return {
    subject: `${heading} - City Delivery Services`,
    html: layout({
      preheader,
      heading,
      intro: `Update on your rider application ${r.applicationId}.`,
      body,
      footer: 'You are receiving this email because a rider application was submitted with this email address. If this was not you, you can ignore this message.',
    }),
    text: [
      `Hi ${r.personalInformation?.fullName},`,
      '',
      intro.replace(/<[^>]*>/g, ''),
      '',
      `Application ID: ${r.applicationId}`,
      `Status: ${r.applicationStatus}`,
      r.riderId ? `Rider ID: ${r.riderId}` : '',
      note || '',
      statusUrl ? `${ctaLabel}: ${statusUrl}` : '',
      '',
      '— City Delivery Services',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function ownerFranchiseApplicationEmail(r) {
  const fee = r.feeSnapshot
    ? `${r.feeSnapshot.currency || 'INR'} ${Number(r.feeSnapshot.amount || 0).toLocaleString('en-IN')} · ${r.feeSnapshot.refundPolicy || ''}`
    : '';
  const body =
    `<tr><td style="padding-top:20px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:14px;padding:9px 16px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
       <span style="display:inline-block;margin-left:8px;font-size:13px;color:${BRAND.muted};">${esc(formatDate(r.createdAt))}</span>
     </td></tr>` +
    section(
      'Applicant',
      row('Full name', r.fullName) +
        row('Mobile number', r.mobile) +
        row('Email', r.email)
    ) +
    section(
      'Proposed location',
      row('State', r.location?.state) +
        row('District', r.location?.district) +
        row('City / town', r.location?.city) +
        row('Preferred operating area', r.location?.preferredOperatingArea) +
        row('PIN code', r.location?.pincode) +
        row('Full address', r.location?.fullAddress, { multiline: true })
    ) +
    section(
      'Business details',
      row('Business experience', r.business?.experience, { multiline: true }) +
        row('Investment capacity', r.business?.investmentCapacity) +
        row('Office / shop available', r.business?.hasOfficeOrShop ? 'Yes' : 'No') +
        row('Number of vehicles', r.business?.numberOfVehicles ?? 0) +
        row('Why they want to partner', r.business?.motivation, { multiline: true })
    ) +
    section(
      'Initial payment',
      row('Amount shown to applicant', fee) +
        row('Payment status', r.payment?.status) +
        row('Documents uploaded', `${(r.uploadedDocuments && Object.keys(r.uploadedDocuments).length) || 0} file(s)`)
    ) +
    `<tr><td style="padding-top:22px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
       Review transaction details and documents in the secure admin dashboard.
     </td></tr>`;

  return {
    subject: `New Franchise Application - City Delivery Services (#${r.applicationId})`,
    html: layout({
      preheader: `${r.fullName} applied to become a franchise partner.`,
      heading: 'New franchise application',
      intro: 'A new franchise partner application was submitted through the website.',
      body,
      footer: 'You are receiving this because this address is configured as OWNER_EMAIL for City Delivery Services.',
    }),
    text: [
      `New franchise application (#${r.applicationId})`,
      `Submitted: ${formatDate(r.createdAt)}`,
      `Name: ${r.fullName}`,
      `Mobile: ${r.mobile}`,
      `Email: ${r.email}`,
      `Location: ${r.location?.preferredOperatingArea}, ${r.location?.city}, ${r.location?.district}, ${r.location?.state} - ${r.location?.pincode}`,
      `Investment capacity: ${r.business?.investmentCapacity}`,
      `Fee: ${fee || '—'}`,
      `Payment status: ${r.payment?.status}`,
      '',
      'Review transaction details and documents in the secure admin dashboard.',
    ].join('\n'),
  };
}

function franchiseSubmissionEmail(r, statusUrl) {
  const fee = r.feeSnapshot
    ? `${r.feeSnapshot.currency || 'INR'} ${Number(r.feeSnapshot.amount || 0).toLocaleString('en-IN')}`
    : '';
  const body =
    `<tr><td style="padding-top:22px;font-size:15px;line-height:1.65;color:${BRAND.text};">
       Hi ${esc(r.fullName)},<br><br>
       Thank you for your interest in becoming a City Delivery Services franchise partner. We have received your application and will contact you about the next steps.
     </td></tr>
     <tr><td style="padding-top:18px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
     </td></tr>` +
    section(
      'Your application',
      row('Proposed area', r.location?.preferredOperatingArea) +
        row('City / town', r.location?.city) +
        row('Initial payment shown', fee) +
        row('Payment policy', r.feeSnapshot?.refundPolicy) +
        row('Current status', r.applicationStatus)
    ) +
    (r.feeSnapshot?.refundPolicyDetails
      ? `<tr><td style="padding-top:20px;font-size:14px;line-height:1.65;color:${BRAND.text};white-space:pre-wrap;">${esc(r.feeSnapshot.refundPolicyDetails)}</td></tr>`
      : '') +
    `<tr><td style="padding-top:22px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
       Submission does not guarantee approval, an agreement, exclusive territory or any income. All franchise terms are confirmed only after review and a written agreement.
     </td></tr>` +
    statusButton(statusUrl);

  return {
    subject: 'Your Franchise Application Has Been Received - City Delivery Services',
    html: layout({
      preheader: `Your franchise application ID is ${r.applicationId}.`,
      heading: 'Application received',
      intro: 'We are reviewing your franchise application.',
      body,
      footer: 'You are receiving this email because a franchise application was submitted with this email address. If this was not you, you can ignore this message.',
    }),
    text: `Hi ${r.fullName},\n\nWe have received your franchise application.\n\nApplication ID: ${r.applicationId}\nArea: ${r.location?.preferredOperatingArea || '—'}\nCity: ${r.location?.city || '—'}\nInitial payment: ${fee || '—'}\nPayment policy: ${r.feeSnapshot?.refundPolicy || '—'}\nStatus: ${r.applicationStatus}\n\nCheck status: ${statusUrl || '—'}\n\nSubmission does not guarantee approval, an agreement, territory or income.\n\n— City Delivery Services`,
  };
}

function franchiseStatusUpdateEmail(r, { heading, preheader, intro, note, statusUrl, ctaLabel = 'Check application status' }) {
  const body =
    `<tr><td style="padding-top:22px;font-size:15px;line-height:1.65;color:${BRAND.text};">
       Hi ${esc(r.fullName)},<br><br>${intro}
     </td></tr>
     <tr><td style="padding-top:18px;">
       <span style="display:inline-block;background:${BRAND.green};color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;letter-spacing:.5px;">Application ID: ${esc(r.applicationId)}</span>
     </td></tr>` +
    section(
      'Current status',
      row('Status', r.applicationStatus) + (r.franchiseId ? row('Franchise ID', r.franchiseId) : '')
    ) +
    (note ? `<tr><td style="padding-top:20px;font-size:14px;line-height:1.65;color:${BRAND.text};white-space:pre-wrap;">${esc(note)}</td></tr>` : '') +
    statusButton(statusUrl, ctaLabel);

  return {
    subject: `${heading} - City Delivery Services`,
    html: layout({
      preheader,
      heading,
      intro: `Update on your franchise application ${r.applicationId}.`,
      body,
      footer: 'You are receiving this email because a franchise application was submitted with this email address. If this was not you, you can ignore this message.',
    }),
    text: [
      `Hi ${r.fullName},`,
      '',
      intro.replace(/<[^>]*>/g, ''),
      '',
      `Application ID: ${r.applicationId}`,
      `Status: ${r.applicationStatus}`,
      r.franchiseId ? `Franchise ID: ${r.franchiseId}` : '',
      note || '',
      statusUrl ? `${ctaLabel}: ${statusUrl}` : '',
      '',
      '— City Delivery Services',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

module.exports = {
  ownerRequestEmail,
  customerConfirmationEmail,
  ownerContactEmail,
  ownerRiderApplicationEmail,
  riderSubmissionEmail,
  riderStatusUpdateEmail,
  ownerFranchiseApplicationEmail,
  franchiseSubmissionEmail,
  franchiseStatusUpdateEmail,
};
