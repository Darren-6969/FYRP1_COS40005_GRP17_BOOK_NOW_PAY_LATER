import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Inbox, RefreshCw, Send, UserRound } from "lucide-react";
import {
  getSupportTicket,
  getSupportTickets,
  reassignSupportTicket,
  replyToSupportTicket,
  resolveSupportTicket,
} from "../../services/support_service";
import { getOperators } from "../../services/admin_service";
import styles from "../../assets/styles/support/TicketWorkspace.module.css";

// The ticket list and the open ticket, shared by the operator Customer
// messages page and the admin Support page (development plan Step 9).
// mode "operator": the operator's own tickets. mode "admin": every ticket,
// with filters and reassigning.

const TOPIC_LABEL = {
  BOOKING: "Booking",
  PAYMENT: "Payment or refund",
  OPERATOR_PROBLEM: "Problem with an operator",
  ACCOUNT: "Account",
  OTHER: "Other",
};

const STATUS_LABEL = { OPEN: "Open", ANSWERED: "Answered", RESOLVED: "Resolved" };

const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Open and answered" },
  { value: "OPEN", label: "Open" },
  { value: "ANSWERED", label: "Answered" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
];

const POLL_MS = 30 * 1000;

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function dueText(ticket) {
  if (ticket.status !== "OPEN") return null;
  const ms = new Date(ticket.dueAt) - Date.now();
  if (ms < 0) return "Overdue";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return hours ? `Reply within ${hours}h ${minutes}m` : `Reply within ${minutes}m`;
}

function errorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function StatusPill({ ticket }) {
  const tone = ticket.overdue ? "overdue" : ticket.status.toLowerCase();
  return (
    <span className={styles.pill} data-tone={tone}>
      {ticket.overdue ? "Overdue" : STATUS_LABEL[ticket.status]}
    </span>
  );
}

function TicketList({ tickets, selectedId, onSelect, loading }) {
  if (loading && !tickets.length) return <p className={styles.muted}>Loading…</p>;
  if (!tickets.length) {
    return (
      <div className={styles.empty}>
        <Inbox size={28} aria-hidden="true" />
        <p>No tickets here.</p>
      </div>
    );
  }
  return (
    <ul className={styles.list}>
      {tickets.map((t) => (
        <li key={t.id}>
          <button type="button" className={styles.row} aria-current={t.id === selectedId ? "true" : undefined} onClick={() => onSelect(t.id)}>
            <span className={styles.rowTop}>
              <strong>{t.reference}</strong>
              <StatusPill ticket={t} />
            </span>
            <span className={styles.rowSummary}>{t.summary}</span>
            <span className={styles.rowMeta}>
              {TOPIC_LABEL[t.topic] || t.topic}
              {t.booking ? ` · ${t.booking.code}` : ""} · {t.customer.name} · {when(t.createdAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Transcript({ lines }) {
  return (
    <ol className={styles.transcript}>
      {lines.map((line) => (
        <li key={line.id} className={styles.line} data-role={line.role}>
          <span className={styles.lineWho}>
            {line.role === "customer" ? "Customer" : line.role === "assistant" ? "Assistant" : line.from}
            <span className={styles.lineTime}>{when(line.createdAt)}</span>
          </span>
          <span className={styles.lineText}>{line.text}</span>
          {line.cars?.length > 0 && <span className={styles.lineCars}>Cars shown: {line.cars.join(", ")}</span>}
        </li>
      ))}
    </ol>
  );
}

function Reassign({ ticket, operators, onDone }) {
  const [target, setTarget] = useState(ticket.route === "ADMIN" ? "ADMIN" : String(ticket.operator?.id || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = ticket.route === "ADMIN" ? "ADMIN" : String(ticket.operator?.id || "");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const body = target === "ADMIN" ? { route: "ADMIN" } : { route: "OPERATOR", operatorId: Number(target) };
      const { data } = await reassignSupportTicket(ticket.id, body);
      onDone(data);
    } catch (err) {
      setError(errorMessage(err, "The ticket couldn't be reassigned."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.reassign}>
      <label htmlFor="ticket-assign">Assigned to</label>
      <select id="ticket-assign" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy || ticket.status === "RESOLVED"}>
        <option value="ADMIN">Platform support</option>
        {operators.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.companyName}
          </option>
        ))}
      </select>
      <button type="button" className={styles.secondary} onClick={submit} disabled={busy || target === current || ticket.status === "RESOLVED"}>
        Reassign
      </button>
      {error && <span className={styles.inlineError}>{error}</span>}
    </div>
  );
}

function TicketDetail({ detail, mode, operators, bookingHref, onChanged }) {
  const { ticket, transcript } = detail;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resolved = ticket.status === "RESOLVED";

  const run = async (fn, fallback) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await fn();
      onChanged(data);
      return true;
    } catch (err) {
      setError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await run(() => replyToSupportTicket(ticket.id, text.trim()), "The reply couldn't be sent.")) setText("");
  };

  return (
    <section className={styles.detail} aria-label={`Ticket ${ticket.reference}`}>
      <header className={styles.detailHead}>
        <div>
          <h2>
            {ticket.reference} <StatusPill ticket={ticket} />
          </h2>
          <p className={styles.summary}>{ticket.summary}</p>
        </div>
        {!resolved && (
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => run(() => resolveSupportTicket(ticket.id), "The ticket couldn't be resolved.")}>
            <CheckCircle2 size={16} aria-hidden="true" /> Mark resolved
          </button>
        )}
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Customer</dt>
          <dd>
            <UserRound size={14} aria-hidden="true" /> {ticket.customer.name}
            {ticket.customer.email ? ` · ${ticket.customer.email}` : ""}
          </dd>
        </div>
        <div>
          <dt>Topic</dt>
          <dd>{TOPIC_LABEL[ticket.topic] || ticket.topic}</dd>
        </div>
        {ticket.booking && (
          <div>
            <dt>Booking</dt>
            <dd>
              {bookingHref ? <Link to={bookingHref(ticket.booking)}>{ticket.booking.code}</Link> : ticket.booking.code} · {ticket.booking.status}
            </dd>
          </div>
        )}
        <div>
          <dt>Raised</dt>
          <dd>{when(ticket.createdAt)}</dd>
        </div>
        {dueText(ticket) && (
          <div>
            <dt>Reply target</dt>
            <dd className={ticket.overdue ? styles.overdueText : undefined}>
              <Clock size={14} aria-hidden="true" /> {dueText(ticket)}
            </dd>
          </div>
        )}
      </dl>

      {mode === "admin" && <Reassign key={`${ticket.id}-${ticket.route}-${ticket.operator?.id}`} ticket={ticket} operators={operators} onDone={onChanged} />}

      <Transcript lines={transcript} />

      {resolved ? (
        <p className={styles.muted}>This ticket is resolved. If the customer asks again in the chat, a new ticket is raised.</p>
      ) : (
        <form className={styles.reply} onSubmit={send}>
          <label htmlFor="ticket-reply">
            Reply to the customer{!ticket.customer.signedIn ? " (sent by email; they aren't signed in)" : " (shown in their chat and emailed)"}
          </label>
          <textarea id="ticket-reply" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
          <div className={styles.replyBar}>
            {error && <span className={styles.inlineError}>{error}</span>}
            <button type="submit" className={styles.primary} disabled={busy || !text.trim()}>
              <Send size={16} aria-hidden="true" /> Send reply
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function TicketWorkspace({ mode = "operator", bookingHref }) {
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get("ticket")) || null;
  const [filters, setFilters] = useState({ status: "ACTIVE", topic: "", operatorId: "", overdue: false });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [operators, setOperators] = useState([]);

  const query = useMemo(() => {
    const q = { status: filters.status };
    if (filters.topic) q.topic = filters.topic;
    if (mode === "admin" && filters.operatorId) q.operatorId = filters.operatorId;
    if (filters.overdue) q.overdue = "1";
    return q;
  }, [filters, mode]);

  // Bumped to reload the list now (the refresh button, after a reply).
  const [reloadKey, setReloadKey] = useState(0);
  const loadList = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await getSupportTickets(query);
        if (cancelled) return;
        setTickets(data.tickets);
        setError("");
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Tickets couldn't be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [query, reloadKey]);

  useEffect(() => {
    if (mode !== "admin") return;
    getOperators()
      .then(({ data }) => setOperators((Array.isArray(data) ? data : data?.operators || []).filter((o) => o.status !== "PENDING")))
      .catch(() => setOperators([]));
  }, [mode]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await getSupportTicket(selectedId);
        if (cancelled) return;
        setDetail(data);
        setDetailError("");
      } catch (err) {
        if (!cancelled) setDetailError(errorMessage(err, "This ticket couldn't be opened."));
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId]);

  // The open ticket only shows once it has loaded for the current selection.
  const shownDetail = selectedId && detail?.ticket.id === selectedId ? detail : null;
  const shownError = selectedId ? detailError : "";
  const select = (id) => {
    setDetailError("");
    setParams(id ? { ticket: String(id) } : {});
  };
  const changed = (data) => {
    setDetail(data);
    loadList();
  };
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const overdueCount = tickets.filter((t) => t.overdue).length;

  return (
    <div className={styles.workspace}>
      <aside className={styles.side}>
        <div className={styles.filters}>
          <select aria-label="Status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value, overdue: false })}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select aria-label="Topic" value={filters.topic} onChange={(e) => setFilter({ topic: e.target.value })}>
            <option value="">All topics</option>
            {Object.entries(TOPIC_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {mode === "admin" && (
            <select aria-label="Operator" value={filters.operatorId} onChange={(e) => setFilter({ operatorId: e.target.value })}>
              <option value="">All operators</option>
              {operators.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.companyName}
                </option>
              ))}
            </select>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilter({ overdue: e.target.checked })} /> Overdue only
          </label>
          <button type="button" className={styles.iconButton} onClick={loadList} aria-label="Refresh">
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
        {overdueCount > 0 && !filters.overdue && (
          <p className={styles.alert}>
            <AlertTriangle size={15} aria-hidden="true" /> {overdueCount} past the reply target
          </p>
        )}
        {error && <p className={styles.inlineError}>{error}</p>}
        <TicketList tickets={tickets} selectedId={selectedId} onSelect={select} loading={loading} />
      </aside>

      <div className={styles.main}>
        {shownError && <p className={styles.inlineError}>{shownError}</p>}
        {shownDetail && !shownError ? (
          <TicketDetail detail={shownDetail} mode={mode} operators={operators} bookingHref={bookingHref} onChanged={changed} />
        ) : (
          !shownError && (
            <div className={styles.empty}>
              <Inbox size={32} aria-hidden="true" />
              <p>Pick a ticket to read the chat and reply.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
