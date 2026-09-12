import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import { submitCustomerPayment } from "../../hooks/usePayments";
import { createStripeCheckoutSession } from "../../services/customer_service";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import duitnowQr from "../../assets/images/duitnow-qr.png";

const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
};

function PaymentChoice({ label, description, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`customer-payment-option ${selected ? "selected" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{selected ? "●" : "○"}</span>
      <div>
        <strong>{label}</strong>
        <small>{disabled ? "Already paid or unavailable" : description}</small>
      </div>
    </button>
  );
}

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, loading, error } = useCustomerBooking(id);

  const [method, setMethod] = useState("");
  const [paymentType, setPaymentType] = useState(PAYMENT_TYPES.DOWN_PAYMENT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isManualPayment = method === "DUITNOW_SPAY";
  const downPaymentPaid = booking?.payment?.downPaymentStatus === "PAID";
  const finalPaymentPaid = booking?.payment?.finalPaymentStatus === "PAID";

const acceptedPaymentMethods = useMemo(() => {
  return booking?.operator?.config?.acceptedPaymentMethods || {};
}, [booking]);

const paymentOptions = useMemo(() => {
  return [
    acceptedPaymentMethods.stripe && [
      "STRIPE",
      "Stripe",
      "Card payment using Stripe sandbox",
    ],
    acceptedPaymentMethods.duitnowSpay && [
      "DUITNOW_SPAY",
      "DuitNow / SPay",
      "Scan DuitNow QR and upload receipt for verification",
    ],
  ].filter(Boolean);
}, [acceptedPaymentMethods]);

useEffect(() => {
  if (!method && paymentOptions.length > 0) {
    setMethod(paymentOptions[0][0]);
  }

  if (
    method &&
    paymentOptions.length > 0 &&
    !paymentOptions.some(([value]) => value === method)
  ) {
    setMethod(paymentOptions[0][0]);
  }
}, [method, paymentOptions]);

  const handlePay = async () => {
    setSubmitError("");

    if (isManualPayment) {
      navigate(`/customer/upload-receipt/${id}?method=DUITNOW_SPAY&paymentType=${paymentType}`);
      return;
    }

    if (method === "STRIPE") {
      setSubmitting(true);

      try {
        const res = await createStripeCheckoutSession(id, paymentType);
        window.location.href = res.data.url;
      } catch (err) {
        setSubmitError(
          err.response?.data?.message || "Failed to start Stripe checkout"
        );
        setSubmitting(false);
      }

      return;
    }

    setSubmitting(true);

    try {
      await submitCustomerPayment(id, {
        method,
        transactionId: `${method}-${Date.now()}`,
      });

      navigate(`/customer/payment-status/${id}`);
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading payment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-page">
        <div className="customer-alert customer-alert-danger">{error}</div>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="customer-page">
      <section className="customer-checkout-layout">
        <article className="customer-glass-card">
          <p className="customer-eyebrow">Checkout</p>
          <h1>Complete Payment</h1>

          <div className="customer-info-list detail">
            <div>
              <span>Booking ID</span>
              <strong>{booking.bookingCode || booking.id}</strong>
            </div>

            <div>
              <span>Service</span>
              <strong>{booking.serviceName}</strong>
            </div>

            <div>
              <span>Pick-up</span>
              <strong>{formatCustomerDate(booking.pickupDate)}</strong>
            </div>

            <div>
              <span>Return</span>
              <strong>{formatCustomerDate(booking.returnDate)}</strong>
            </div>

            <div>
              <span>Payment Deadline</span>
              <strong>
                {paymentType === PAYMENT_TYPES.DOWN_PAYMENT
                  ? formatCustomerDate(booking.payment?.downPaymentDueDate)
                  : formatCustomerDate(booking.payment?.finalPaymentDueDate)}
              </strong>
            </div>

            <div>
              <span>Amount to Pay</span>
              <strong>
                {formatMoney(
                  paymentType === PAYMENT_TYPES.DOWN_PAYMENT
                    ? booking.payment?.downPaymentAmount
                    : paymentType === PAYMENT_TYPES.FINAL_PAYMENT
                      ? booking.payment?.finalPaymentAmount
                      : booking.totalAmount
                )}
              </strong>
            </div>
          </div>
        </article>

        <article className="customer-glass-card">
          <h2>Payment Plan</h2>
          <div className="customer-payment-options">
            <PaymentChoice
              label="Pay down-payment"
              description={`${formatMoney(booking.payment?.downPaymentAmount)} due ${formatCustomerDate(booking.payment?.downPaymentDueDate)}`}
              selected={paymentType === PAYMENT_TYPES.DOWN_PAYMENT}
              disabled={downPaymentPaid || finalPaymentPaid}
              onClick={() => setPaymentType(PAYMENT_TYPES.DOWN_PAYMENT)}
            />
            <PaymentChoice
              label="Pay final payment"
              description={`${formatMoney(booking.payment?.finalPaymentAmount)} due ${formatCustomerDate(booking.payment?.finalPaymentDueDate)}`}
              selected={paymentType === PAYMENT_TYPES.FINAL_PAYMENT}
              disabled={!downPaymentPaid || finalPaymentPaid}
              onClick={() => setPaymentType(PAYMENT_TYPES.FINAL_PAYMENT)}
            />
            <PaymentChoice
              label="Pay full amount"
              description={formatMoney(booking.totalAmount)}
              selected={paymentType === PAYMENT_TYPES.FULL_PAYMENT}
              disabled={downPaymentPaid || finalPaymentPaid}
              onClick={() => setPaymentType(PAYMENT_TYPES.FULL_PAYMENT)}
            />
          </div>

          <h2>Payment Method</h2>

          <div className="customer-payment-options">
            {paymentOptions.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                className={`customer-payment-option ${
                  method === value ? "selected" : ""
                }`}
                onClick={() => setMethod(value)}
              >
                <span>{method === value ? "●" : "○"}</span>

                <div>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </div>
              </button>
            ))}
            {paymentOptions.length === 0 && (
              <div className="customer-alert customer-alert-danger">
                No payment method is currently available for this booking. Please contact the operator.
              </div>
            )}
          </div>

          {method === "STRIPE" && (
            <p className="customer-payment-note">
              You will be redirected to Stripe&apos;s secure checkout. Use card{" "}
              <strong>4242 4242 4242 4242</strong>, any future expiry, and any
              CVC in the sandbox.
            </p>
          )}

          {isManualPayment && (
            <div className="customer-manual-payment-panel">
              <div className="customer-manual-payment-header">
                <div>
                  <p className="customer-eyebrow">Manual Payment</p>
                  <h3>DuitNow QR Payment</h3>
                </div>

                <span className="customer-status status-warning">
                  Receipt Required
                </span>
              </div>

              <div className="customer-qr-section">
                <div className="customer-qr-box">
                  <img src={duitnowQr} alt="DuitNow QR Code" />
                </div>

                <div className="customer-qr-instructions">
                  <p>
                    Scan this DuitNow QR code using your banking app or SPay.
                    After completing payment, upload your receipt for operator
                    verification.
                  </p>

                  <div className="customer-info-list compact">
                    <div>
                      <span>Amount</span>
                      <strong>
                        {formatMoney(
                          paymentType === PAYMENT_TYPES.DOWN_PAYMENT
                            ? booking.payment?.downPaymentAmount
                            : paymentType === PAYMENT_TYPES.FINAL_PAYMENT
                              ? booking.payment?.finalPaymentAmount
                              : booking.totalAmount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Reference</span>
                      <strong>
                        {booking.bookingCode || `BNPL-${booking.id}`}
                      </strong>
                    </div>

                    <div>
                      <span>Deadline</span>
                      <strong>
                        {formatCustomerDate(
                          paymentType === PAYMENT_TYPES.DOWN_PAYMENT
                            ? booking.payment?.downPaymentDueDate
                            : booking.payment?.finalPaymentDueDate
                        )}
                      </strong>
                    </div>
                  </div>

                  <p className="customer-payment-note">
                    If your payment app allows remarks, please include the
                    booking reference. Then click continue and upload your
                    receipt.
                  </p>
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="customer-alert customer-alert-danger">
              {submitError}
            </div>
          )}

          <button
            className="customer-primary-btn full"
            disabled={submitting || paymentOptions.length === 0}
            onClick={handlePay}
          >
            {isManualPayment
              ? "Continue to Receipt Upload"
              : submitting
              ? "Processing..."
              : `Pay ${formatMoney(
                  paymentType === PAYMENT_TYPES.DOWN_PAYMENT
                    ? booking.payment?.downPaymentAmount
                    : paymentType === PAYMENT_TYPES.FINAL_PAYMENT
                      ? booking.payment?.finalPaymentAmount
                      : booking.totalAmount
                )}`}
          </button>
        </article>
      </section>
    </div>
  );
}