// The operator as a customer sees it in a booking, an invoice or a payment.
//
// A customer needs the operator's name, logo and contact details, and which
// payment methods it takes. The rest of the operator record (API key hash,
// Stripe account, subscription, allowed origins, DuitNow account and so on) is
// the operator's business and is never sent. Add a field here only when a
// customer screen needs it.

export function mapOperatorForCustomer(operator) {
  if (!operator) return null;
  const config = operator.configs?.[0];

  return {
    id: operator.id,
    companyName: operator.companyName,
    email: operator.email,
    phone: operator.phone,
    logoUrl: operator.logoUrl,
    config: config
      ? {
          acceptedPaymentMethods: config.acceptedPaymentMethods,
          invoiceLogoUrl: config.invoiceLogoUrl,
        }
      : null,
  };
}
