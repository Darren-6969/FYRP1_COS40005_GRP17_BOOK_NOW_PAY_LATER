// Which email types a user may switch off from their profile page.
//
// The four toggles on the customer, operator and admin profile pages map to
// the User columns below. Anything that asks the recipient to act, protects
// their money or their account, or was sent because they asked for it is
// ESSENTIAL and always goes out. An unknown type is treated as essential, so
// a new email is never silently dropped because nobody added it here.

export const PREFERENCE_COLUMNS = {
  bookingUpdates: "notifyBookingUpdates",
  paymentReminders: "notifyPaymentReminders",
  invoices: "notifyInvoices",
  promotions: "notifyPromotions",
};

const OPTIONAL_TYPES = {
  // Booking progress the recipient can also see in the dashboard
  BOOKING_REQUEST_RECEIVED: "bookingUpdates",
  BOOKING_HANDED_OVER: "bookingUpdates",
  BOOKING_COMPLETED: "bookingUpdates",
  CUSTOMER_ACCEPTED_ALTERNATIVE: "bookingUpdates",
  CUSTOMER_REJECTED_ALTERNATIVE: "bookingUpdates",
  PAYMENT_CONFIRMED: "bookingUpdates",

  // Early reminders. The final reminder and the overdue notice stay essential
  PAYMENT_REMINDER: "paymentReminders",
  REMINDER: "paymentReminders",

  // Documents first sent automatically. A resend the user asked for is essential
  INVOICE_SENT: "invoices",
  PAYMENT_RECEIPT_ISSUED: "invoices",
};

export function preferenceFor(type) {
  return OPTIONAL_TYPES[type] || null;
}

export function preferenceColumnFor(type) {
  const preference = preferenceFor(type);
  return preference ? PREFERENCE_COLUMNS[preference] : null;
}

const PREFERENCE_LABELS = {
  bookingUpdates: "booking update",
  paymentReminders: "payment reminder",
  invoices: "invoice and receipt",
  promotions: "promotional",
};

export function optOutReason(type) {
  const preference = preferenceFor(type);
  return preference
    ? `Recipient has turned off ${PREFERENCE_LABELS[preference]} emails in their profile.`
    : null;
}
