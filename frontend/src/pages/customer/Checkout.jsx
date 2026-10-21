import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import { submitCustomerPayment } from "../../hooks/usePayments";
import { createStripeCheckoutSession } from "../../services/customer_service";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import duitnowQr from "../../assets/images/duitnow-qr.png";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";

const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
};

function dueCountdown(value) {
  const hours = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 3600000));
  if (hours < 24) return hours === 0 ? "Due now" : `Due in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.ceil(hours / 24);
  return `Due in ${days} ${days === 1 ? "day" : "days"}`;
}

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
  const { enabled: receiptUploadEnabled } = useFeatureFlag(
    "allowReceiptUpload",
    booking?.operatorId
  );
  const [searchParams] = useSearchParams();
  const requestedType = PAYMENT_TYPES[searchParams.get("type")] || null;

  const [method, setMethod] = useState("");
  const [chosenType, setChosenType] = useState(requestedType);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [, refreshCountdown] = useState(0);
  // The tier only changes deadlines while the platform's credit tier policy is on.
  const { enabled: tierPolicyOn } = useFeatureFlag("creditTierPolicy", booking?.operatorId);

  useEffect(() => {
    const timer = window.setInterval(() => refreshCountdown((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const downPaymentPaid = booking?.payment?.downPaymentStatus === "PAID";
  const finalPaymentPaid = booking?.payment?.finalPaymentStatus === "PAID";
  // The first part still owed, unless the customer picked one. A 0% deposit
  // is settled on acceptance, so the balance comes first in that case.
  const paymentType =
    chosenType || (downPaymentPaid ? PAYMENT_TYPES.FINAL_PAYMENT : PAYMENT_TYPES.DOWN_PAYMENT);
  const setPaymentType = setChosenType;

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
    acceptedPaymentMethods.duitnowSpay && receiptUploadEnabled && [
      "DUITNOW_SPAY",
      "DuitNow / SPay",
      "Scan DuitNow QR and upload receipt for verification",
    ],
  ].filter(Boolean);
}, [acceptedPaymentMethods, receiptUploadEnabled]);

const effectiveMethod = paymentOptions.some(([value]) => value === method)
  ? method
  : paymentOptions[0]?.[0] || "";

  const handlePay = async () => {
    setSubmitError("");

    if (effectiveMethod === "DUITNOW_SPAY") {
      navigate(`/customer/upload-receipt/${id}?method=DUITNOW_SPAY&paymentType=${paymentType}`);
      return;
    }

    if (effectiveMethod === "STRIPE") {
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
        method: effectiveMethod,
        transactionId: `${effectiveMethod}-${Date.now()}`,
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

  // Payment opens only once the operator has accepted: acceptance creates the
  // payment row and the schedule. Until then there is nothing to pay.
  if (!booking.payment || ["PENDING", "ALTERNATIVE_SUGGESTED"].includes(booking.status)) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">
          <p className="customer-eyebrow">Checkout</p>
          <h1>Waiting for the operator</h1>
          <p>
            {booking.status === "ALTERNATIVE_SUGGESTED"
              ? "The operator has sent you an offer. Accept or decline it on your booking page first."
              : "Your booking request has not been accepted yet. You can pay once the operator accepts it."}
          </p>
          <button
            type="button"
            className="customer-primary-btn"
            onClick={() => navigate(`/customer/bookings/${id}`)}
          >
            Back to my booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-checkout-layout">
        <article className="customer-glass-card">
          <p className="customer-eyebrow">Checkout</p>
          <h1>Complete Payment</h1>
          {tierPolicyOn && booking.creditTier && booking.creditTier !== "Normal" && (
            <div className="customer-alert">
              <strong>Your credit tier: {booking.creditTier}</strong>
              <p>
                {booking.creditTier === "Trusted"
                  ? "Your on-time payment history lets you hold more unpaid bookings at once."
                  : booking.creditTier === "Caution"
                    ? "Your deadlines are shorter than usual. The due dates in the schedule below already include this."
                    : "The full amount is due straight away. The schedule below shows what is owed."}
              </p>
            </div>
          )}

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
          {booking.paymentSchedule?.length > 0 && (
            <>
              <h2>Full payment schedule</h2>
              <div className="customer-info-list detail">
                {booking.paymentSchedule.map((entry) => (
                  <div key={entry.id}>
                    <span>
                      {entry.type === "LICENCE"
                        ? "Driving licence"
                        : entry.paymentPart === "DOWN_PAYMENT"
                          ? "Deposit"
                          : entry.paymentPart === "FINAL_PAYMENT"
                            ? "Balance"
                            : "Full payment"}
                    </span>
                    <strong>
                      {entry.amount ? formatMoney(entry.amount) : "Required"}
                      {" · "}
                      {formatCustomerDate(entry.dueAt)}
                      {" · "}
                      {dueCountdown(entry.dueAt)}
                    </strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <h2>Payment Plan</h2>
          <div className="customer-payment-options">
            <PaymentChoice
              label="Pay down-payment"
              description={`${formatMoney(booking.payment?.downPaymentAmount)} due ${formatCustomerDate(booking.payment?.downPaymentDueDate)}`}
              selected={paymentType === PAYMENT_TYPES.DOWN_PAYMENT}
              disabled={downPaymentPaid}
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
              disabled={downPaymentPaid || finalPaymentPaid || !Number(booking.payment?.finalPaymentAmount)}
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
                  effectiveMethod === value ? "selected" : ""
                }`}
                onClick={() => setMethod(value)}
              >
                <span>{effectiveMethod === value ? "●" : "○"}</span>

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

          {effectiveMethod === "STRIPE" && (
            <p className="customer-payment-note">
              You will be redirected to Stripe&apos;s secure checkout. Use card{" "}
              <strong>4242 4242 4242 4242</strong>, any future expiry, and any
              CVC in the sandbox.
            </p>
          )}

          {effectiveMethod === "DUITNOW_SPAY" && (
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
            {effectiveMethod === "DUITNOW_SPAY"
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