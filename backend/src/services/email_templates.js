function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safe(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function getBookingRef(booking) {
  return booking?.bookingCode || booking?.id || "-";
}

function getInvoiceStatus(invoice, booking) {
  if (invoice?.status === "CANCELLED") return "VOID";
  if (booking?.payment?.status === "PAID") return "PAID";

  if (
    booking?.paymentDeadline &&
    new Date(booking.paymentDeadline) < new Date() &&
    booking?.payment?.status !== "PAID"
  ) {
    return "OVERDUE";
  }

  if (booking?.payment?.status === "PENDING_VERIFICATION") return "PARTIAL";

  return invoice?.status || "GENERATED";
}

function getReceiptNo(payment) {
  const paidDate =
    payment?.paidAt || payment?.updatedAt || payment?.createdAt || new Date();
  const year = new Date(paidDate).getFullYear();

  return `RCP-${year}${String(payment?.id || 0).padStart(4, "0")}`;
}

function getPaymentType(booking, payment) {
  const total = Number(booking?.totalAmount || 0);
  const paid = Number(payment?.amount || 0);

  return paid > 0 && paid < total ? "Deposit" : "Full Payment";
}

function getBalanceRemaining(booking, payment) {
  return Math.max(
    Number(booking?.totalAmount || 0) - Number(payment?.amount || 0),
    0
  );
}

function baseTemplate({ title, body, buttonText, buttonUrl, operator }) {
  const logoHtml = operator?.logoUrl
    ? `<img src="${operator.logoUrl}" alt="Company Logo" style="width:72px;height:72px;object-fit:contain;border-radius:18px;background:#ffffff;margin-bottom:12px;" />`
    : `<div style="width:72px;height:72px;border-radius:18px;background:#2563eb;color:white;display:inline-block;text-align:center;line-height:72px;font-weight:900;margin-bottom:12px;">BNPL</div>`;

  const companyName = operator?.companyName || "Book Now Pay Later";

  return `
    <div style="margin:0;padding:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:860px;margin:0 auto;padding:34px 18px;">
        <div style="background:#ffffff;border:1px solid #dbeafe;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,0.10);">
          
          <div style="padding:28px 32px;background:linear-gradient(135deg,#f8fbff 0%,#eff6ff 100%);border-bottom:1px solid #e2e8f0;">
            ${logoHtml}

            <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">
              ${companyName}
            </p>

            <h1 style="margin:0;font-size:28px;line-height:1.2;color:#0f172a;">
              ${title}
            </h1>
          </div>

          <div style="padding:30px 32px;font-size:14px;line-height:1.65;color:#334155;">
            ${body}

            ${
              buttonText && buttonUrl
                ? `
                  <div style="margin-top:26px;">
                    <a href="${buttonUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:16px;font-weight:900;">
                      ${buttonText}
                    </a>
                  </div>
                `
                : ""
            }
          </div>

          <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
              This is an automated email from ${companyName}.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function badge(label, type = "blue") {
  const colors = {
    blue: ["#dbeafe", "#1d4ed8"],
    green: ["#dcfce7", "#15803d"],
    yellow: ["#fef3c7", "#b45309"],
    red: ["#fee2e2", "#b91c1c"],
    gray: ["#e5e7eb", "#374151"],
  };

  const [bg, color] = colors[type] || colors.blue;

  return `
    <span style="display:inline-block;background:${bg};color:${color};padding:7px 12px;border-radius:999px;font-size:12px;font-weight:900;text-transform:uppercase;">
      ${label}
    </span>
  `;
}

function documentHeader({ title, number, dateLabel, dateValue, operator }) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <tr>
        <td style="vertical-align:top;">
          ${
            operator?.logoUrl
              ? `<img src="${operator.logoUrl}" alt="Merchant Logo" style="width:70px;height:70px;object-fit:contain;border-radius:18px;margin-bottom:10px;" />`
              : `<div style="width:70px;height:70px;border-radius:18px;background:#2563eb;color:white;display:inline-block;text-align:center;line-height:70px;font-weight:900;margin-bottom:10px;">BNPL</div>`
          }
          <h2 style="margin:0;color:#0f172a;font-size:26px;">${title}</h2>
          <p style="margin:6px 0 0;color:#64748b;font-weight:700;">
            ${safe(operator?.companyName, "Merchant")}
          </p>
          <p style="margin:4px 0 0;color:#64748b;">
            ${safe(operator?.email, "")}
            ${operator?.phone ? ` · ${operator.phone}` : ""}
          </p>
        </td>

        <td style="vertical-align:top;text-align:right;">
          <p style="margin:0;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;">
            Reference No.
          </p>
          <p style="margin:4px 0 16px;color:#0f172a;font-size:20px;font-weight:900;">
            ${number}
          </p>
          <p style="margin:0;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;">
            ${dateLabel}
          </p>
          <p style="margin:4px 0 0;color:#0f172a;font-weight:800;">
            ${dateValue}
          </p>
        </td>
      </tr>
    </table>
  `;
}

function infoCard(title, content) {
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;">
      <h3 style="margin:0 0 10px;color:#0f172a;font-size:16px;">${title}</h3>
      <div style="color:#475569;font-size:14px;line-height:1.65;">
        ${content}
      </div>
    </div>
  `;
}

function twoColumnSection(left, right) {
  return `
    <table style="width:100%;border-collapse:separate;border-spacing:0 0;margin:18px 0;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:9px;">
          ${left}
        </td>
        <td style="width:50%;vertical-align:top;padding-left:9px;">
          ${right}
        </td>
      </tr>
    </table>
  `;
}

function breakdownTable(rows) {
  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin-top:12px;">
      <tbody>
        ${rows
          .map(
            (row, index) => `
              <tr style="background:${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                <td style="padding:13px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;">
                  ${row.label}
                </td>
                <td style="padding:13px 16px;color:#0f172a;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:${row.strong ? "900" : "800"};">
                  ${row.value}
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function bookingTable(booking) {
  return breakdownTable([
    {
      label: "Booking Reference",
      value: getBookingRef(booking),
    },
    {
      label: "Service",
      value: safe(booking?.serviceName),
    },
    {
      label: "Pick-up / Check-in",
      value: formatDateTime(booking?.pickupDate),
    },
    {
      label: "Return / Check-out",
      value: formatDateTime(booking?.returnDate),
    },
    {
      label: "Amount",
      value: formatMoney(booking?.totalAmount),
      strong: true,
    },
    {
      label: "Payment Deadline",
      value: formatDateTime(booking?.paymentDeadline),
    },
  ]);
}

export function bookingSubmittedTemplate({ booking, operatorUrl }) {
  return baseTemplate({
    title: "New Booking Request Received",
    buttonText: "Review Booking",
    buttonUrl: operatorUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear Operator,</p>
      <p>A new BNPL booking request has been submitted and is waiting for your review.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function bookingStatusTemplate({
  booking,
  status,
  customerUrl,
  bookingRejectedEmailText,
}) {
  const isRejected = status === "REJECTED";

  return baseTemplate({
    title: `Booking ${titleCase(status)}`,
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear ${
        booking?.customer?.name || "Customer"
      },</p>

      ${
        isRejected && bookingRejectedEmailText
          ? `<p>${bookingRejectedEmailText}</p>`
          : `
            <p>Your booking has been updated to:</p>
            <p style="margin:14px 0;">${badge(titleCase(status), "blue")}</p>
          `
      }

      ${bookingTable(booking)}
    `,
  });
}

export function paymentRequestTemplate({ booking, customerUrl }) {
  return baseTemplate({
    title: "Payment Required",
    buttonText: "Proceed to Payment",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear ${booking?.customer?.name || "Customer"},</p>
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
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear ${booking?.customer?.name || "Customer"},</p>
      <p>The original booking option is unavailable. The operator has suggested an alternative option.</p>

      <h3 style="margin:22px 0 10px;color:#0f172a;">Original Booking</h3>
      ${bookingTable(booking)}

      <h3 style="margin:22px 0 10px;color:#0f172a;">Suggested Alternative</h3>
      ${breakdownTable([
        {
          label: "Alternative Service",
          value: safe(booking?.alternativeServiceName),
        },
        {
          label: "Alternative Pick-up / Check-in",
          value: formatDateTime(booking?.alternativePickupDate || booking?.pickupDate),
        },
        {
          label: "Alternative Return / Check-out",
          value: formatDateTime(booking?.alternativeReturnDate || booking?.returnDate),
        },
        {
          label: "Alternative Amount",
          value: formatMoney(booking?.alternativePrice || booking?.totalAmount),
          strong: true,
        },
      ])}

      ${
        booking?.alternativeReason
          ? `<p style="margin-top:18px;"><strong>Reason:</strong> ${booking.alternativeReason}</p>`
          : ""
      }

      <p>Please review the suggestion and choose whether to accept or reject it.</p>
    `,
  });
}

export function customerAlternativeResponseTemplate({
  booking,
  accepted,
  operatorUrl,
}) {
  return baseTemplate({
    title: accepted ? "Customer Accepted Alternative" : "Customer Rejected Alternative",
    buttonText: "View Booking",
    buttonUrl: operatorUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear Operator,</p>
      <p>
        ${booking?.customer?.name || "The customer"} has ${
      accepted ? "accepted" : "rejected"
    } the alternative suggestion for booking <strong>${getBookingRef(
      booking
    )}</strong>.
      </p>
      ${bookingTable(booking)}
    `,
  });
}

export function receiptUploadedTemplate({ booking, operatorUrl }) {
  return baseTemplate({
    title: "Payment Receipt Uploaded",
    buttonText: "Verify Receipt",
    buttonUrl: operatorUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear Operator,</p>
      <p>The customer has uploaded a payment receipt for verification.</p>
      ${bookingTable(booking)}
    `,
  });
}

/**
 * Merchant/operator email.
 * Customer should receive paymentReceiptTemplate instead.
 */
export function merchantPaymentConfirmedTemplate({
  booking,
  payment,
  operatorUrl,
}) {
  return baseTemplate({
    title: "Payment Confirmed",
    buttonText: "View Payment",
    buttonUrl: operatorUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear Merchant,</p>
      <p>A customer payment has been confirmed for the following BNPL booking.</p>

      ${twoColumnSection(
        infoCard(
          "Customer",
          `
            <p style="margin:0;"><strong>${safe(booking?.customer?.name)}</strong></p>
            <p style="margin:4px 0 0;">${safe(booking?.customer?.email)}</p>
          `
        ),
        infoCard(
          "Payment",
          `
            <p style="margin:0;">Method: <strong>${safe(payment?.method)}</strong></p>
            <p style="margin:4px 0 0;">Amount: <strong>${formatMoney(
              payment?.amount || booking?.totalAmount
            )}</strong></p>
            <p style="margin:4px 0 0;">Paid At: <strong>${formatDateTime(
              payment?.paidAt
            )}</strong></p>
          `
        )
      )}

      ${bookingTable(booking)}

      <p style="margin-top:18px;">
        The customer has been issued an official e-receipt.
      </p>
    `,
  });
}

/**
 * Kept for compatibility if old controller calls still reference it.
 * Prefer merchantPaymentConfirmedTemplate for operator and paymentReceiptTemplate for customer.
 */
export function paymentConfirmedTemplate({ booking, customerUrl }) {
  return baseTemplate({
    title: "Payment Confirmed",
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear ${booking?.customer?.name || "Customer"},</p>
      <p>Your payment for booking <strong>${getBookingRef(
        booking
      )}</strong> has been confirmed.</p>
      ${bookingTable(booking)}
    `,
  });
}

export function invoiceSentTemplate({ invoice, booking, customerUrl }) {
  const operator = booking?.operator || {};
  const status = getInvoiceStatus(invoice, booking);

  const subtotal = Number(invoice?.amount || booking?.totalAmount || 0);
  const amountPaid =
    booking?.payment?.status === "PAID" ? Number(booking?.payment?.amount || 0) : 0;
  const balanceRemaining = Math.max(subtotal - amountPaid, 0);
  const totalAmountDue = balanceRemaining || subtotal;

  return baseTemplate({
    title: "Invoice Issued",
    buttonText: "View Invoice",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      ${documentHeader({
        title: "Invoice",
        number: invoice?.invoiceNo || "-",
        dateLabel: "Issue Date",
        dateValue: formatDate(invoice?.issuedAt || invoice?.createdAt),
        operator,
      })}

      ${twoColumnSection(
        infoCard(
          "Bill To",
          `
            <p style="margin:0;"><strong>${safe(booking?.customer?.name, "Customer")}</strong></p>
            <p style="margin:4px 0 0;">${safe(booking?.customer?.email)}</p>
          `
        ),
        infoCard(
          "Invoice Details",
          `
            <p style="margin:0;">Invoice No.: <strong>${safe(invoice?.invoiceNo)}</strong></p>
            <p style="margin:4px 0 0;">Booking Ref: <strong>${getBookingRef(booking)}</strong></p>
            <p style="margin:4px 0 0;">Due Date: <strong>${formatDateTime(
              booking?.paymentDeadline
            )}</strong></p>
            <p style="margin:10px 0 0;">${badge(status, status === "PAID" ? "green" : status === "OVERDUE" ? "red" : status === "PARTIAL" ? "yellow" : "blue")}</p>
          `
        )
      )}

      <h3 style="margin:24px 0 10px;color:#0f172a;">Booking Summary</h3>
      ${breakdownTable([
        {
          label: "Booking Reference",
          value: getBookingRef(booking),
        },
        {
          label: "Service Description",
          value: safe(booking?.serviceName),
        },
        {
          label: "Service Type",
          value: safe(booking?.serviceType),
        },
        {
          label: "Pick-up / Check-in",
          value: formatDateTime(booking?.pickupDate),
        },
        {
          label: "Return / Check-out",
          value: formatDateTime(booking?.returnDate),
        },
      ])}

      <h3 style="margin:24px 0 10px;color:#0f172a;">Payment Breakdown</h3>
      ${breakdownTable([
        {
          label: "Subtotal",
          value: formatMoney(subtotal),
        },
        {
          label: "Deposit / Amount Paid",
          value: formatMoney(amountPaid),
        },
        {
          label: "Balance Remaining",
          value: formatMoney(balanceRemaining),
        },
        {
          label: "Total Amount Due",
          value: formatMoney(totalAmountDue),
          strong: true,
        },
      ])}

      <h3 style="margin:24px 0 10px;color:#0f172a;">Payment Status</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;">
        <p style="margin:0 0 12px;">Current Status: ${badge(
          status,
          status === "PAID"
            ? "green"
            : status === "OVERDUE"
            ? "red"
            : status === "PARTIAL"
            ? "yellow"
            : "blue"
        )}</p>

        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;">Invoice Issued</td>
            <td style="padding:8px 0;text-align:right;font-weight:800;">
              ${formatDateTime(invoice?.issuedAt || invoice?.createdAt)}
            </td>
          </tr>
          ${
            booking?.payment?.paidAt
              ? `
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Payment Received</td>
                  <td style="padding:8px 0;text-align:right;font-weight:800;">
                    ${formatDateTime(booking.payment.paidAt)}
                  </td>
                </tr>
              `
              : ""
          }
        </table>
      </div>
    `,
  });
}

export function paymentReceiptTemplate({ booking, payment, customerUrl }) {
  const operator = booking?.operator || {};
  const balance = getBalanceRemaining(booking, payment);
  const receiptNumber = getReceiptNo(payment);

  return baseTemplate({
    title: "Booking Confirmed & Official Receipt",
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">
        Dear ${booking?.customer?.name || "Customer"},
      </p>

      <p>
        Your payment has been received and your booking is now fully confirmed.
        Please keep this official receipt for your records.
      </p>

      ${documentHeader({
        title: "Official Receipt",
        number: receiptNumber,
        dateLabel: "Payment Date",
        dateValue: formatDateTime(payment?.paidAt),
        operator,
      })}

      ${twoColumnSection(
        infoCard(
          "Received From",
          `
            <p style="margin:0;"><strong>${safe(booking?.customer?.name, "Customer")}</strong></p>
            <p style="margin:4px 0 0;">${safe(booking?.customer?.email)}</p>
          `
        ),
        infoCard(
          "Payment Detail",
          `
            <p style="margin:0;">Booking Ref: <strong>${getBookingRef(booking)}</strong></p>
            <p style="margin:4px 0 0;">Service: <strong>${safe(booking?.serviceName)}</strong></p>
            <p style="margin:4px 0 0;">Payment Method: <strong>${safe(payment?.method)}</strong></p>
            <p style="margin:4px 0 0;">Transaction ID: <strong>${safe(
              payment?.transactionId
            )}</strong></p>
            <p style="margin:4px 0 0;">Payment Type: <strong>${getPaymentType(
              booking,
              payment
            )}</strong></p>
          `
        )
      )}

      <h3 style="margin:24px 0 10px;color:#0f172a;">Summary</h3>
      ${breakdownTable([
        {
          label: "Total Booking Value",
          value: formatMoney(booking?.totalAmount),
        },
        {
          label: "Amount Paid This Transaction",
          value: formatMoney(payment?.amount),
        },
        {
          label: "Amount Paid To Date",
          value: formatMoney(payment?.amount),
        },
        {
          label: "Balance Remaining",
          value: formatMoney(balance),
          strong: true,
        },
      ])}

      <div style="margin-top:20px;padding:16px;border-radius:18px;background:#eff6ff;color:#1d4ed8;text-align:center;font-weight:900;">
        This receipt is computer-generated and is valid without signature.
      </div>

      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">
        Operator Contact: ${safe(operator?.email, "-")}
        ${operator?.phone ? ` · ${operator.phone}` : ""}
      </p>
    `,
  });
}

export function autoRejectedBookingTemplate({
  booking,
  customerUrl,
  autoRejectedEmailText,
}) {
  return baseTemplate({
    title: "Booking Auto-Rejected",
    buttonText: "View Booking",
    buttonUrl: customerUrl,
    operator: booking?.operator,
    body: `
      <p style="margin-top:0;">Dear ${booking?.customer?.name || "Customer"},</p>

      ${
        autoRejectedEmailText
          ? `<p>${autoRejectedEmailText}</p>`
          : `
            <p>
              Your booking request has been automatically rejected because no operator action
              was taken before the booking response deadline.
            </p>
          `
      }

      ${bookingTable(booking)}
    `,
  });
}