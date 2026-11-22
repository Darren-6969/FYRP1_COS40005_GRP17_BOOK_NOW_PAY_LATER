import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCustomer } from "../../services/admin_service";
import CustomerStatusPill from "../../components/system/CustomerStatusPill";
import DeleteCustomerDialog from "../../components/system/DeleteCustomerDialog";
import { formatDate, formatMoney, statusLabel } from "../../components/system/customerFormat";
import styles from "../../assets/styles/master/Customers.module.css";

// One customer for the admin: profile, bookings, refunds, licence status and
// support requests, and deleting the account when the customer asks.
// The licence document itself is never shown here, only its status.

const SIGNUP_SOURCE = { HOST: "Partner booking site" };

export default function CustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await getCustomer(id);
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? "This customer does not exist." : err.response?.data?.message || "Could not load this customer.");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onDeleted = async (result) => {
    setDeleting(false);
    if (result?.alreadyDeleted) {
      setNotice("This account had already been deleted.");
    } else {
      const parts = ["Account deleted. The customer can no longer sign in."];
      parts.push(result?.emailSent ? "A confirmation email was sent." : "The confirmation email could not be sent, so let the customer know yourself.");
      if (result?.filesFailed) parts.push(`${result.filesFailed} licence file(s) could not be removed from storage; ask the platform team to remove them.`);
      setNotice(parts.join(" "));
    }
    await load();
  };

  if (error) {
    return (
      <div className={styles.page}>
        <Link className={styles.back} to="/master/customers">
          <ArrowLeft size={16} aria-hidden="true" /> All customers
        </Link>
        <section className="card">
          <div className="alert danger" role="alert">
            {error}
          </div>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <section className="card">
          <div className="empty-state" aria-live="polite">Loading customer...</div>
        </section>
      </div>
    );
  }

  const { customer, bookings, bookingTotal, refunds, licence, tickets, deletionRequest } = data;
  const deleted = customer.customerStatus === "DELETED";

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/master/customers">
        <ArrowLeft size={16} aria-hidden="true" /> All customers
      </Link>

      {notice && (
        <div className="alert" role="status">
          {notice}
        </div>
      )}

      {deletionRequest && !deleted && (
        <div className={styles.requestBanner} role="note">
          <strong>Deletion requested</strong> on {formatDate(deletionRequest.requestedAt, true)} (support request{" "}
          <span className={styles.code}>{deletionRequest.reference}</span>). Check the list below, then delete the
          account at the bottom of this page.
        </div>
      )}

      <section className="card">
        <div className={styles.header}>
          <div>
            <h3>{customer.name || "Unnamed customer"}</h3>
            <span className={styles.code}>{customer.userCode}</span>
          </div>
          <CustomerStatusPill customer={customer} />
        </div>

        <dl className={styles.facts}>
          <Fact label="Email" value={customer.email} />
          <Fact label="Phone" value={customer.phone || "-"} />
          <Fact label="Joined" value={formatDate(customer.createdAt)} />
          <Fact label="Signed up through" value={SIGNUP_SOURCE[customer.provisionedVia] || "Website or app"} />
          <Fact label="Terms accepted" value={formatDate(customer.termsAcceptedAt)} />
          <Fact label="Privacy notice accepted" value={formatDate(customer.privacyPolicyAcceptedAt)} />
          <Fact
            label="Driving licence"
            value={licence ? `${statusLabel(licence.status)} (sent ${formatDate(licence.submittedAt)})` : "None uploaded"}
          />
        </dl>
      </section>

      <section className="card">
        <h4 className={styles.sectionTitle}>
          Bookings <span className={styles.muted}>({bookingTotal})</span>
        </h4>
        {!bookings.length ? (
          <div className="empty-state">No bookings yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Booking</th>
                  <th scope="col">Car</th>
                  <th scope="col">Operator</th>
                  <th scope="col">Pickup</th>
                  <th scope="col">Return</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <Link className={styles.rowLink} to={`/master/bookings?q=${encodeURIComponent(booking.bookingCode)}`}>
                        {booking.bookingCode}
                      </Link>
                    </td>
                    <td>{booking.serviceName}</td>
                    <td>{booking.operator?.companyName || "-"}</td>
                    <td>{formatDate(booking.pickupDate, true)}</td>
                    <td>{formatDate(booking.returnDate, true)}</td>
                    <td>{formatMoney(booking.totalAmount)}</td>
                    <td>
                      <span className={`badge ${String(booking.status).toLowerCase()}`}>{statusLabel(booking.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookingTotal > bookings.length && (
              <p className={styles.muted}>Showing the latest {bookings.length}. Search the Booking Log for older ones.</p>
            )}
          </div>
        )}
      </section>

      {refunds.length > 0 && (
        <section className="card">
          <h4 className={styles.sectionTitle}>Refunds</h4>
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Booking</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Method</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td>{refund.booking?.bookingCode || "-"}</td>
                    <td>{formatMoney(refund.amount)}</td>
                    <td>{statusLabel(refund.method)}</td>
                    <td>
                      <span className={`badge ${String(refund.status).toLowerCase()}`}>{statusLabel(refund.status)}</span>
                    </td>
                    <td>{formatDate(refund.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tickets.length > 0 && (
        <section className="card">
          <h4 className={styles.sectionTitle}>Support requests</h4>
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Topic</th>
                  <th scope="col">Status</th>
                  <th scope="col">Raised</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className={styles.code}>{ticket.reference}</td>
                    <td>{statusLabel(ticket.topic)}</td>
                    <td>{statusLabel(ticket.status)}</td>
                    <td>{formatDate(ticket.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {deleted ? (
        <div className={styles.deletedNote}>
          This account was deleted at the customer&apos;s request. Their bookings, payments and invoices are kept as
          financial records; their contact details, licence, chats and saved cars were removed.
        </div>
      ) : (
        <section className={styles.danger} aria-labelledby="danger-title">
          <div>
            <h4 id="danger-title">Delete this account</h4>
            <p>
              Only when the customer asks. Their sign-in, contact details, licence and chats are removed; bookings,
              payments and invoices are kept. This cannot be undone.
            </p>
          </div>
          <button className="btn danger" type="button" onClick={() => setDeleting(true)}>
            Delete account
          </button>
        </section>
      )}

      {deleting && (
        <DeleteCustomerDialog customerId={customer.id} onClose={() => setDeleting(false)} onDeleted={onDeleted} />
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
