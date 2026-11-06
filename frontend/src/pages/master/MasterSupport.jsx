import TicketWorkspace from "../../components/support/TicketWorkspace";

// Support (development plan Step 9): every request raised from the chatbot.
// Payments, refunds, disputes, accounts and visitors' questions come here;
// booking questions go to the operator, and can be reassigned either way.
export default function MasterSupport() {
  return (
    <main className="master-page">
      <div className="page-header">
        <div>
          <h1>Support Tickets</h1>
          <p>Requests customers and visitors raised from the chat assistant. Replies reach signed-in customers in their chat and by email; visitors get email only.</p>
        </div>
      </div>
      <TicketWorkspace mode="admin" bookingHref={(b) => `/master/bookings?q=${encodeURIComponent(b.code)}`} />
    </main>
  );
}
