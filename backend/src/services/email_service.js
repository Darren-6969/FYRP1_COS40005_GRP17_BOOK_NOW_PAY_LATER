import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const from = `"BNPL Platform" <${process.env.EMAIL_USER}>`;

// ── Booking created → customer ────────────────────────────────────────────────
export async function sendBookingCreatedEmail(customerEmail, customerName, booking) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: `Booking Received — ${booking.serviceName}`,
    html: `
      <h2>Booking Received</h2>
      <p>Hi ${customerName},</p>
      <p>Your booking for <strong>${booking.serviceName}</strong> has been received and is under review.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.id}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Service</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.serviceName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd">RM ${Number(booking.totalAmount).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Status</strong></td><td style="padding:8px;border:1px solid #ddd">Pending Review</td></tr>
      </table>
      <p>You will be notified once the operator reviews your booking.</p>
    `,
  }).catch(err => console.error("Email error [bookingCreated]:", err.message));
}

// ── Booking accepted → customer with payment deadline ─────────────────────────
export async function sendBookingAcceptedEmail(customerEmail, customerName, booking, paymentDeadline) {
  const deadline = new Date(paymentDeadline).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "full",
    timeStyle: "short",
  });
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: `Booking Accepted — Payment Required by ${deadline}`,
    html: `
      <h2 style="color:#16a34a;">Booking Accepted! ✅</h2>
      <p>Hi ${customerName},</p>
      <p>Great news! Your booking for <strong>${booking.serviceName}</strong> has been accepted.</p>
      <p><strong>⏰ Please complete payment by: ${deadline}</strong></p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.id}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Service</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.serviceName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Amount Due</strong></td><td style="padding:8px;border:1px solid #ddd">RM ${Number(booking.totalAmount).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Payment Deadline</strong></td><td style="padding:8px;border:1px solid #ddd;color:#dc2626">${deadline}</td></tr>
      </table>
      <p>Log in to your dashboard to complete payment via DuitNow and upload your receipt.</p>
      <p style="color:#6b7280;font-size:12px;">Missing the deadline may result in automatic cancellation of your booking.</p>
    `,
  }).catch(err => console.error("Email error [bookingAccepted]:", err.message));
}

// ── Booking rejected → customer ───────────────────────────────────────────────
export async function sendBookingRejectedEmail(customerEmail, customerName, booking) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: `Booking Update — ${booking.serviceName}`,
    html: `
      <h2>Booking Update</h2>
      <p>Hi ${customerName},</p>
      <p>Unfortunately, your booking for <strong>${booking.serviceName}</strong> could not be accommodated at this time.</p>
      <p>Booking ID: <strong>${booking.id}</strong></p>
      <p>Please contact the operator or try booking a different service.</p>
    `,
  }).catch(err => console.error("Email error [bookingRejected]:", err.message));
}

// ── Alternative suggested → customer ─────────────────────────────────────────
export async function sendSuggestionEmail(customerEmail, customerName, originalService, newService, bookingId) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: "Alternative Service Suggested for Your Booking",
    html: `
      <h2>Alternative Service Suggested</h2>
      <p>Hi ${customerName},</p>
      <p>The <strong>${originalService}</strong> you booked is currently unavailable.</p>
      <p>The operator has suggested an alternative: <strong>${newService}</strong>.</p>
      <p>Booking ID: <strong>${bookingId}</strong></p>
      <p>Please log in to your dashboard to <strong>accept or decline</strong> this alternative.</p>
    `,
  }).catch(err => console.error("Email error [suggestion]:", err.message));
}

// ── Payment reminder → customer ───────────────────────────────────────────────
export async function sendPaymentReminderEmail(customerEmail, customerName, booking, paymentDeadline) {
  const deadline = new Date(paymentDeadline).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "full",
    timeStyle: "short",
  });
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: `⚠️ Payment Reminder — Due ${deadline}`,
    html: `
      <h2 style="color:#d97706;">Payment Reminder ⚠️</h2>
      <p>Hi ${customerName},</p>
      <p>This is a reminder that your payment for <strong>${booking.serviceName}</strong> is due soon.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.id}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Amount Due</strong></td><td style="padding:8px;border:1px solid #ddd">RM ${Number(booking.totalAmount).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9"><strong>Deadline</strong></td><td style="padding:8px;border:1px solid #ddd;color:#dc2626"><strong>${deadline}</strong></td></tr>
      </table>
      <p>Please log in and upload your DuitNow receipt before the deadline to avoid cancellation.</p>
    `,
  }).catch(err => console.error("Email error [reminder]:", err.message));
}

// ── Payment confirmed → customer ──────────────────────────────────────────────
export async function sendPaymentConfirmedEmail(customerEmail, customerName, bookingId) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: "Payment Confirmed — Booking Secured ✅",
    html: `
      <h2 style="color:#16a34a;">Payment Confirmed ✅</h2>
      <p>Hi ${customerName},</p>
      <p>Your payment for Booking ID <strong>${bookingId}</strong> has been verified.</p>
      <p>Your booking is now officially <strong>confirmed</strong>. Thank you!</p>
      <p style="color:#6b7280;font-size:12px;">An invoice has been generated and is available in your dashboard.</p>
    `,
  }).catch(err => console.error("Email error [paymentConfirmed]:", err.message));
}

// ── Payment overdue → customer ────────────────────────────────────────────────
export async function sendOverdueEmail(customerEmail, customerName, bookingId, serviceName) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: `Booking Cancelled — Payment Overdue`,
    html: `
      <h2 style="color:#dc2626;">Booking Cancelled</h2>
      <p>Hi ${customerName},</p>
      <p>Your booking for <strong>${serviceName}</strong> (ID: <strong>${bookingId}</strong>) has been cancelled because the payment deadline passed without payment.</p>
      <p>If you believe this is an error, please contact the operator directly.</p>
    `,
  }).catch(err => console.error("Email error [overdue]:", err.message));
}

// ── Receipt rejected → customer ───────────────────────────────────────────────
export async function sendReceiptRejectedEmail(customerEmail, customerName, bookingId, remarks) {
  await transporter.sendMail({
    from,
    to: customerEmail,
    subject: "Receipt Rejected — Please Resubmit",
    html: `
      <h2 style="color:#dc2626;">Receipt Rejected</h2>
      <p>Hi ${customerName},</p>
      <p>Your payment receipt for Booking ID <strong>${bookingId}</strong> was rejected.</p>
      <p><strong>Reason:</strong> ${remarks || "The receipt could not be verified."}</p>
      <p>Please log in and upload a clearer DuitNow receipt before the deadline.</p>
    `,
  }).catch(err => console.error("Email error [receiptRejected]:", err.message));
}
