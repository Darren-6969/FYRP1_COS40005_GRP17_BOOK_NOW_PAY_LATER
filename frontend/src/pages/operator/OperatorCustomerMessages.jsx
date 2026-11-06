import TicketWorkspace from "../../components/support/TicketWorkspace";

// Customer messages (development plan Step 9): requests customers raised
// from the chatbot about one of this operator's bookings. Overdue first.
export default function OperatorCustomerMessages() {
  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">From the chat assistant</p>
          <h1>Customer messages</h1>
          <p>Questions customers asked to pass to you about their bookings. Your reply appears in their chat and is emailed to them.</p>
        </div>
      </section>
      <TicketWorkspace mode="operator" bookingHref={(b) => `/operator/bookings/${b.id}`} />
    </div>
  );
}
