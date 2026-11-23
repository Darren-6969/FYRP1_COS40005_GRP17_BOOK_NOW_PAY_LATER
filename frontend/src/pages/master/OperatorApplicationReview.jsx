import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  getOperatorApplications,
  getOperatorDocument,
  reviewOperatorApplication,
} from "../../services/admin_service";
import styles from "../../assets/styles/master/ApplicationReview.module.css";

// Operator application review: a queue on the left, the selected applicant on
// the right with a documents checklist and the decision. The server applies
// the real rules (operator_type_rules.js); this page mirrors them so the
// administrator sees what is needed before pressing Approve.

// Drivers can only be booked while these are valid, so the expiry date is
// recorded on approval.
const EXPIRY_DOCUMENTS = ["DRIVING_LICENCE", "PSV_LICENCE"];

function malaysiaDate(offsetDays = 0) {
  const now = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return now.toISOString().slice(0, 10);
}
const todayIso = () => malaysiaDate(0);
const tomorrowIso = () => malaysiaDate(1);

const TYPES = {
  CAR_RENTAL: {
    label: "Car rental company",
    tone: "car",
    check: "Check the business registration and business licence match the applicant.",
  },
  TOUR_GUIDE: {
    label: "Tour guide",
    tone: "guide",
    check: "Check the MOTAC tourist guide licence is valid and matches the ID.",
  },
  DRIVER: {
    label: "Driver",
    tone: "driver",
    check: "Check the driving licence and PSV licence are valid and match the ID.",
  },
};

// Same as APPLICATION_RULES in backend/src/services/operator_type_rules.js.
// `required`: needed to approve (signup or approval rule).
const DOCUMENTS = {
  CAR_RENTAL: [
    { type: "BUSINESS_REGISTRATION", required: true },
    { type: "BUSINESS_LICENSE", required: true },
    { type: "OWNER_IDENTITY", required: true },
  ],
  TOUR_GUIDE: [
    { type: "TOURIST_GUIDE_LICENCE", required: true },
    { type: "BUSINESS_REGISTRATION", required: false },
    { type: "OWNER_IDENTITY", required: true },
  ],
  DRIVER: [
    { type: "DRIVING_LICENCE", required: true },
    { type: "PSV_LICENCE", required: true },
    { type: "OWNER_IDENTITY", required: true },
  ],
};

const DOCUMENT_LABELS = {
  BUSINESS_REGISTRATION: "Business registration (SSM)",
  BUSINESS_LICENSE: "Business licence",
  OWNER_IDENTITY: "Identity card or passport",
  TOURIST_GUIDE_LICENCE: "Tourist guide licence (MOTAC)",
  DRIVING_LICENCE: "Driving licence",
  PSV_LICENCE: "PSV licence",
};

const STATUS = {
  SUBMITTED: { label: "Waiting for review", tone: "waiting" },
  UNDER_REVIEW: { label: "Waiting for review", tone: "waiting" },
  NEEDS_INFORMATION: { label: "Asked for more information", tone: "info" },
  APPROVED: { label: "Approved", tone: "approved" },
  REJECTED: { label: "Rejected", tone: "rejected" },
};

const DECISIONS = {
  APPROVED: {
    button: "Approve",
    confirm: "Approve application",
    label: "Note for the record",
    hint: "Approving activates the operator and emails the owner a link to set their password.",
    quick: ["All documents checked and valid."],
  },
  NEEDS_INFORMATION: {
    button: "Ask for more information",
    confirm: "Send request",
    label: "What should the applicant send? (they see this)",
    hint: "The applicant is emailed your message and replies by email. You can still approve afterwards.",
    quick: [
      "Please send a clearer copy of your licence.",
      "The name on your licence does not match your ID.",
      "Please send your business licence.",
    ],
  },
  REJECTED: {
    button: "Reject",
    confirm: "Reject application",
    label: "Reason for rejecting (the applicant sees this)",
    hint: "Rejecting closes the application and suspends the account. It cannot be undone here.",
    quick: [
      "The licence has expired.",
      "The documents do not match the applicant.",
      "We could not verify the business.",
    ],
  },
};

const FILTERS = [
  ["ALL", "All"],
  ["CAR_RENTAL", "Car rental"],
  ["TOUR_GUIDE", "Tour guide"],
  ["DRIVER", "Driver"],
];

const MIN_REASON = 5;

function typeOf(application) {
  return application.operator?.operatorType || "CAR_RENTAL";
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function waitingFor(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatSize(bytes) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The documents this type sends, matched to what was uploaded. Uploads of
// other kinds (older applications) are listed after them.
function documentRows(application) {
  const uploaded = application.documents || [];
  const rules = DOCUMENTS[typeOf(application)] || [];
  const rows = rules.map((rule) => ({
    ...rule,
    label: DOCUMENT_LABELS[rule.type] || rule.type,
    document: uploaded.find((doc) => doc.documentType === rule.type) || null,
  }));
  uploaded
    .filter((doc) => !rules.some((rule) => rule.type === doc.documentType))
    .forEach((doc) =>
      rows.push({ type: doc.documentType, required: false, label: DOCUMENT_LABELS[doc.documentType] || doc.documentType, document: doc })
    );
  return rows;
}

function Badge({ tone, children }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`] || ""}`}>{children}</span>;
}

export default function OperatorApplicationReview() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState({});
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // Expiry dates typed off the licence documents, by document id.
  const [expiry, setExpiry] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getOperatorApplications();
      const list = res.data || [];
      setApplications(list);
      setSelectedId((current) => (list.some((a) => a.id === current) ? current : list[0]?.id ?? null));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operator applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const byType = (type) => applications.filter((a) => type === "ALL" || typeOf(a) === type).length;
    return {
      byType,
      waiting: applications.filter((a) => a.status !== "NEEDS_INFORMATION").length,
      info: applications.filter((a) => a.status === "NEEDS_INFORMATION").length,
    };
  }, [applications]);

  const queue = applications.filter((a) => filter === "ALL" || typeOf(a) === filter);
  const selected = applications.find((a) => a.id === selectedId) || null;

  const selectApplication = (id) => {
    setSelectedId(id);
    setDecision(null);
    setReason("");
    setNotice(null);
    setExpiry({});
  };

  const viewDocument = async (document) => {
    try {
      const response = await getOperatorDocument(document.id);
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open the document.");
    }
  };

  const confirmDecision = async () => {
    if (!selected || !decision || reason.trim().length < MIN_REASON) return;
    try {
      setSaving(true);
      setError("");
      const documentExpiry = Object.fromEntries(
        selected.documents
          .filter((doc) => EXPIRY_DOCUMENTS.includes(doc.documentType) && expiry[doc.id])
          .map((doc) => [doc.id, expiry[doc.id]])
      );
      const response = await reviewOperatorApplication(selected.id, decision, reason.trim(), documentExpiry);
      setNotice({
        tone: decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "info",
        text: `${selected.operator?.companyName}: ${response.data.message || "Decision saved."}`,
      });
      setDecision(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the decision.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !applications.length) {
    return <section className={styles.panel}>Loading operator applications...</section>;
  }

  const rows = selected ? documentRows(selected) : [];
  const key = (row) => `${selected?.id}:${row.type}`;
  const sent = rows.filter((row) => row.document);
  const checkedCount = sent.filter((row) => checked[key(row)]).length;
  const needsExpiry = (row) => typeOf(selected) === "DRIVER" && EXPIRY_DOCUMENTS.includes(row.type) && row.document;
  const approveReady =
    rows.filter((row) => row.required).every((row) => row.document && checked[key(row)]) &&
    rows.filter(needsExpiry).every((row) => expiry[row.document.id] > todayIso());
  const missingRequired = rows.some((row) => row.required && !row.document);
  const type = selected ? TYPES[typeOf(selected)] || TYPES.CAR_RENTAL : null;
  const status = selected ? STATUS[selected.status] || STATUS.SUBMITTED : null;
  const applicant = selected?.operator?.users?.[0]?.name || "-";
  const config = decision ? DECISIONS[decision] : null;
  const reasonOk = reason.trim().length >= MIN_REASON;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Operator applications</h2>
          <p className={styles.lede}>Check each applicant's documents, then approve, ask for more information or reject.</p>
        </div>
        <div className={styles.stats}>
          <div className={`${styles.stat} ${styles.stat_waiting}`}>
            <span>Waiting for review</span>
            <strong>{counts.waiting}</strong>
          </div>
          <div className={`${styles.stat} ${styles.stat_info}`}>
            <span>Asked for more information</span>
            <strong>{counts.info}</strong>
          </div>
          <button className={styles.secondary} type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className={`${styles.notice} ${styles.notice_rejected}`} role="alert">
          {error}
        </div>
      )}

      <div className={styles.layout}>
        <section className={styles.queue} aria-labelledby="queue-h">
          <h3 id="queue-h" className={styles.sectionTitle}>
            Applications
          </h3>
          <div className={styles.filters} role="group" aria-label="Filter by type">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${styles.filter} ${filter === value ? styles.filterOn : ""}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} <span>{counts.byType(value)}</span>
              </button>
            ))}
          </div>

          {queue.length === 0 ? (
            <p className={styles.muted}>
              {applications.length ? "No applications of this type are waiting." : "No operator applications are waiting for review."}
            </p>
          ) : (
            <ul className={styles.queueList}>
              {queue.map((application) => {
                const t = TYPES[typeOf(application)] || TYPES.CAR_RENTAL;
                const st = STATUS[application.status] || STATUS.SUBMITTED;
                const on = application.id === selectedId;
                return (
                  <li key={application.id}>
                    <button
                      type="button"
                      className={`${styles.queueItem} ${on ? styles.queueItemOn : ""}`}
                      aria-current={on ? "true" : undefined}
                      onClick={() => selectApplication(application.id)}
                    >
                      <span className={styles.queueBadges}>
                        <Badge tone={t.tone}>{t.label}</Badge>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                      <strong>{application.operator?.companyName}</strong>
                      <span className={styles.muted}>
                        {application.operator?.users?.[0]?.name || application.operator?.email} · waiting{" "}
                        {waitingFor(application.submittedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected && (
          <section className={styles.detail} aria-labelledby="detail-h">
            {notice && (
              <div className={`${styles.notice} ${styles[`notice_${notice.tone}`]}`} role="status">
                {notice.text}
              </div>
            )}

            <div className={styles.detailHead}>
              <span className={styles.queueBadges}>
                <Badge tone={type.tone}>{type.label}</Badge>
                <Badge tone={status.tone}>{status.label}</Badge>
              </span>
              <h3 id="detail-h" className={styles.detailTitle}>
                {selected.operator?.companyName}
              </h3>
              <span className={styles.muted}>
                Submitted {formatDate(selected.submittedAt)} · {selected.operator?.operatorCode}
              </span>
            </div>

            <dl className={styles.facts}>
              <div>
                <dt>Applicant</dt>
                <dd>{applicant}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.operator?.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.operator?.phone || "Not given"}</dd>
              </div>
              <div>
                <dt>Registration number</dt>
                <dd>{selected.businessRegistrationNumber || "Not given (optional for this type)"}</dd>
              </div>
              <div className={styles.factWide}>
                <dt>Address</dt>
                <dd>{selected.businessAddress}</dd>
              </div>
            </dl>

            <div className={styles.block}>
              <div className={styles.blockHead}>
                <h4>Documents</h4>
                <span className={styles.muted}>
                  {checkedCount} of {sent.length} checked
                </span>
              </div>
              <p className={styles.muted}>{type.check}</p>
              <ul className={styles.docs}>
                {rows.map((row) => {
                  const k = key(row);
                  const isChecked = Boolean(checked[k]);
                  const missing = !row.document;
                  const tag = missing ? (row.required ? "Missing" : "Not sent") : row.required ? "Required" : "Optional";
                  return (
                    <li key={row.type} className={`${styles.doc} ${missing && row.required ? styles.docMissing : ""}`}>
                      <span className={styles.docIcon} aria-hidden="true">
                        <FileText size={20} />
                      </span>
                      <span className={styles.docText}>
                        <strong>
                          {row.label}{" "}
                          <Badge tone={missing && row.required ? "rejected" : row.required ? "car" : "plain"}>{tag}</Badge>
                        </strong>
                        <span className={styles.muted}>
                          {row.document
                            ? `${row.document.originalName} · ${formatSize(row.document.sizeBytes)}`
                            : row.required
                              ? "Not uploaded. Ask the applicant for it."
                              : "Not uploaded. Optional for this type."}
                        </span>
                      </span>
                      {row.document && (
                        <span className={styles.docActions}>
                          <button type="button" className={styles.secondary} onClick={() => viewDocument(row.document)}>
                            View
                          </button>
                          <label className={`${styles.check} ${isChecked ? styles.checkOn : ""}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => setChecked((c) => ({ ...c, [k]: !isChecked }))}
                            />
                            Checked
                          </label>
                          {needsExpiry(row) && (
                            <label className={styles.expiry}>
                              Expires
                              <input
                                type="date"
                                min={tomorrowIso()}
                                value={expiry[row.document.id] || ""}
                                onChange={(e) => setExpiry((x) => ({ ...x, [row.document.id]: e.target.value }))}
                                aria-label={`${row.label} expiry date`}
                              />
                            </label>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={styles.block}>
              <h4>Decision</h4>
              <div className={styles.decisions} role="group" aria-label="Decision">
                {Object.entries(DECISIONS).map(([code, d]) => {
                  const blocked = code === "APPROVED" && !approveReady;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`${styles.decision} ${styles[`decision_${code}`]} ${decision === code ? styles.decisionOn : ""}`}
                      aria-pressed={decision === code}
                      disabled={blocked || saving}
                      onClick={() => {
                        setDecision(code);
                        setReason("");
                      }}
                    >
                      {d.button}
                    </button>
                  );
                })}
              </div>
              {!approveReady && (
                <p className={styles.warn}>
                  {missingRequired
                    ? "A required document is missing. Ask for more information, or reject."
                    : typeOf(selected) === "DRIVER"
                      ? "Tick every required document as checked and enter the licence and PSV expiry dates to approve."
                      : "Tick every required document as checked to approve."}
                </p>
              )}

              {config && (
                <div className={styles.reasonBox}>
                  <label htmlFor="review-reason" className={styles.reasonLabel}>
                    {config.label}
                  </label>
                  <div className={styles.quick}>
                    {config.quick.map((text) => (
                      <button key={text} type="button" className={styles.chip} onClick={() => setReason(text)}>
                        {text}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="review-reason"
                    rows={3}
                    className={styles.textarea}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-describedby="review-reason-hint"
                  />
                  <span id="review-reason-hint" className={styles.muted}>
                    {config.hint} At least {MIN_REASON} characters.
                  </span>
                  <div className={styles.reasonActions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        setDecision(null);
                        setReason("");
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`${styles.confirm} ${styles[`confirm_${decision}`]}`}
                      onClick={confirmDecision}
                      disabled={!reasonOk || saving}
                    >
                      {saving ? "Saving..." : config.confirm}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.block}>
              <h4>History</h4>
              <ol className={styles.history}>
                <li>
                  <span>{formatDate(selected.submittedAt)}</span>
                  <span>Application submitted</span>
                </li>
                {[...(selected.reviews || [])].reverse().map((review) => (
                  <li key={review.id}>
                    <span>{formatDate(review.createdAt)}</span>
                    <span>
                      {(STATUS[review.decision] || { label: review.decision }).label} by {review.reviewer?.name || "an administrator"}
                      : {review.reason}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
