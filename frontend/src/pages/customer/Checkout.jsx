import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import { submitCustomerPayment } from "../../hooks/usePayments";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, loading, error } = useCustomerBooking(id);
  const [method, setMethod] = useState("STRIPE");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handlePay = async () => {
    setSubmitError("");
    if (method === "DUITNOW_SPAY") {
      navigate(`/customer/upload-receipt/${id}`);
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

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading payment...</div></div>;
  if (error) return <div className="customer-page"><div className="customer-alert customer-alert-danger">{error}</div></div>;
  if (!booking) return null;

  return (
    <div className="customer-page">
      <section className="customer-checkout-layout">
        <article className="customer-glass-card">
          <p className="customer-eyebrow">Checkout</p>
          <h1>Complete Payment</h1>
          <div className="customer-info-list detail">
            <div><span>Booking ID</span><strong>{booking.id}</strong></div>
            <div><span>Service</span><strong>{booking.serviceName}</strong></div>
            <div><span>Pick-up</span><strong>{formatCustomerDate(booking.pickupDate)}</strong></div>
            <div><span>Payment Deadline</span><strong>{formatCustomerDate(booking.paymentDeadline)}</strong></div>
            <div><span>Amount to Pay</span><strong>{formatMoney(booking.totalAmount)}</strong></div>
          </div>
        </article>

        <article className="customer-glass-card">
          <h2>Payment Method</h2>
          <div className="customer-payment-options">
            {[
              ["STRIPE", "Stripe", "Card payment using Stripe sandbox"],
              ["PAYPAL", "PayPal", "Redirect-style PayPal sandbox payment"],
              ["DUITNOW_SPAY", "DuitNow / SPay", "Upload receipt for host verification"],
            ].map(([value, label, description]) => (
              <button
                key={value}
                className={`customer-payment-option ${method === value ? "selected" : ""}`}
                onClick={() => setMethod(value)}
              >
                <span>{method === value ? "●" : "○"}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </div>
              </button>
            ))}
          </div>

          {method === "STRIPE" && (
            <div className="customer-card-form">
              <input placeholder="Card number" defaultValue="4242 4242 4242 4242" />
              <div>
                <input placeholder="MM / YY" defaultValue="12 / 30" />
                <input placeholder="CVC" defaultValue="123" />
              </div>
              <input placeholder="Name on card" defaultValue="Demo Customer" />
            </div>
          )}

          {submitError && <div className="customer-alert customer-alert-danger">{submitError}</div>}

          <button className="customer-primary-btn full" disabled={submitting} onClick={handlePay}>
            {method === "DUITNOW_SPAY" ? "Continue to Receipt Upload" : submitting ? "Processing..." : `Pay ${formatMoney(booking.totalAmount)}`}
          </button>
        </article>
      </section>
    </div>
  );
}
