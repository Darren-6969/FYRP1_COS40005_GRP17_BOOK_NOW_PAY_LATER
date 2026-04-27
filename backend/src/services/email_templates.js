function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function baseTemplate({ title, body, buttonText, buttonUrl }) {
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;padding:30px;box-shadow:0 20px 60px rgba(15,23,42,0.08);">
          <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
            Book Now Pay Later
          </p>

          <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#111827;">
            ${title}
          </h1>

          <div style="font-size:14px;line-height:1.65;color:#334155;">
            ${body}
          </div>

          ${
            buttonText && buttonUrl
              ? `
                <div style="margin-top:26px;">
                  <a href="${buttonUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:13px 20px;border-radius:14px;font-weight:800;">
                    ${buttonText}
                  </a>
                </div>
              `
              : ""
          }

          <hr style="border:0;border-top:1px solid #e5e7eb;margin:30px 0 18px;" />

          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
            This is an automated email from the Book Now Pay Later system.
          </p>
        </div>
      </div>
    </div>
  `;
}

function bookingTable(booking) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="padding:9px 0;color:#64748b;">Booking ID</td>
        <td style="padding:9px 0;text-align:right;"><strong>${booking.bookingCode || booking.id}</strong></td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">Service</td>
        <td style="padding:9px 0;text-align:right;"><strong>${booking.serviceName || "-"}</strong></td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">Pick-up / Check-in</td>
        <td style="padding:9px 0;text-align:right;"><strong>${formatDate(booking.pickupDate)}</strong></td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">Return / Check-out</td>
        <td style="padding:9px 0;text-align:right;"><strong>${formatDate(booking.returnDate)}</strong></td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">Amount</td>
        <td style="padding:9px 0;text-align:right;"><strong>${formatMoney(booking.totalAmount)}</strong></td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;">Payment Deadline</td>
        <td style="padding:9px 0;text-align:right;"><strong>${formatDate(booking.paymentDeadline)}</strong></td>
      </tr>
    </table>
  `;
}

export function bookingSubmittedTemplate({ booking, operatorUrl }) {
  return baseTemplate({
    title: "New Booking Request Received",
    buttonText: "Review Booking",
    buttonUrl: operatorUrl,
    body: `
      <p>Dear Operator,</p>
      <p>A new BNPL booking request has been submitted and is waiting for your review.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function bookingStatusTemplate({ booking, status, customerUrl }) {
  return baseTemplate({
    title: `Booking ${titleCase(status)}`,
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    body: `
      <p>Dear ${booking.customer?.name || "Customer"},</p>
      <p>Your booking has been updated to:</p>
      <p style="font-size:18px;font-weight:800;color:#2563eb;">${titleCase(status)}</p>
      ${bookingTable(booking)}
    `,
  });
}

export function paymentRequestTemplate({ booking, customerUrl }) {
  return baseTemplate({
    title: "Payment Required",
    buttonText: "Proceed to Payment",
    buttonUrl: customerUrl,
    body: `
      <p>Dear ${booking.customer?.name || "Customer"},</p>
      <p>Your booking has been accepted. Please complete the payment before the deadline.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function alternativeSuggestionTemplate({ booking, customerUrl }) {
  return baseTemplate({
    title: "Alternative Booking Suggested",
    buttonText: "Review Alternative",
    buttonUrl: customerUrl,
    body: `
      <p>Dear ${booking.customer?.name || "Customer"},</p>
      <p>The original booking option is unavailable. The operator has suggested an alternative option.</p>

      <h3 style="margin-top:22px;">Original Booking</h3>
      ${bookingTable(booking)}

      <h3 style="margin-top:22px;">Suggested Alternative</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr>
          <td style="padding:9px 0;color:#64748b;">Alternative Service</td>
          <td style="padding:9px 0;text-align:right;"><strong>${booking.alternativeServiceName || "-"}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Alternative Pick-up / Check-in</td>
          <td style="padding:9px 0;text-align:right;"><strong>${formatDate(booking.alternativePickupDate || booking.pickupDate)}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Alternative Return / Check-out</td>
          <td style="padding:9px 0;text-align:right;"><strong>${formatDate(booking.alternativeReturnDate || booking.returnDate)}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Alternative Amount</td>
          <td style="padding:9px 0;text-align:right;"><strong>${formatMoney(booking.alternativePrice || booking.totalAmount)}</strong></td>
        </tr>
      </table>

      ${
        booking.alternativeReason
          ? `<p style="margin-top:18px;"><strong>Reason:</strong> ${booking.alternativeReason}</p>`
          : ""
      }

      <p>Please review the suggestion and choose whether to accept or reject it.</p>
    `,
  });
}

export function customerAlternativeResponseTemplate({ booking, accepted, operatorUrl }) {
  return baseTemplate({
    title: accepted ? "Customer Accepted Alternative" : "Customer Rejected Alternative",
    buttonText: "View Booking",
    buttonUrl: operatorUrl,
    body: `
      <p>Dear Operator,</p>
      <p>${booking.customer?.name || "The customer"} has ${
        accepted ? "accepted" : "rejected"
      } the alternative suggestion for booking <strong>${booking.bookingCode || booking.id}</strong>.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function receiptUploadedTemplate({ booking, operatorUrl }) {
  return baseTemplate({
    title: "Payment Receipt Uploaded",
    buttonText: "Verify Receipt",
    buttonUrl: operatorUrl,
    body: `
      <p>Dear Operator,</p>
      <p>The customer has uploaded a payment receipt for verification.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function paymentConfirmedTemplate({ booking, customerUrl }) {
  return baseTemplate({
    title: "Payment Confirmed",
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    body: `
      <p>Dear ${booking.customer?.name || "Customer"},</p>
      <p>Your payment for booking <strong>${booking.bookingCode || booking.id}</strong> has been confirmed.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function invoiceSentTemplate({ invoice, booking, customerUrl }) {
  return baseTemplate({
    title: "Your Invoice Is Ready",
    buttonText: "View Invoice",
    buttonUrl: customerUrl,
    body: `
      <p>Dear ${booking.customer?.name || "Customer"},</p>
      <p>Your invoice has been generated and sent.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr>
          <td style="padding:9px 0;color:#64748b;">Invoice No.</td>
          <td style="padding:9px 0;text-align:right;"><strong>${invoice.invoiceNo}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Booking ID</td>
          <td style="padding:9px 0;text-align:right;"><strong>${booking.bookingCode || booking.id}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Service</td>
          <td style="padding:9px 0;text-align:right;"><strong>${booking.serviceName}</strong></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#64748b;">Amount</td>
          <td style="padding:9px 0;text-align:right;"><strong>${formatMoney(invoice.amount)}</strong></td>
        </tr>
      </table>

      ${
        invoice.pdfUrl
          ? `<p style="margin-top:16px;">PDF: <a href="${invoice.pdfUrl}">${invoice.pdfUrl}</a></p>`
          : ""
      }
    `,
  });
}