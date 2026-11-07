import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, GripVertical, Info, KeyRound, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  confirmAiPrices,
  getAiOverview,
  reorderAiModels,
  setAiLiveMode,
  updateAiModel,
  updateAiSettings,
} from "../../services/ai_admin_service";
import styles from "../../assets/styles/master/AiModels.module.css";

// The chatbot's AI models (development plan Step 11), laid out status first:
// what is answering customers right now and whether it is safe, then the
// models, the cost controls, and the monitoring panels as supporting detail.
// API keys are never shown or typed here; the page only says whether each
// one is set.

const STATUS = {
  active: { label: "Active", tone: "ok" },
  failing: { label: "Failing", tone: "warn" },
  skipped: { label: "Skipped", tone: "warn" },
  capped: { label: "Cap reached", tone: "bad" },
  no_key: { label: "No API key", tone: "bad" },
  off: { label: "Off", tone: "muted" },
};

// Chart series: distinct from the status colours, and dark enough to read
// as legend text on white (all 4.5:1 or more).
const SERIES = ["#1d4ed8", "#0f766e", "#7c3aed", "#be185d", "#334155"];

const ERROR_WORDS = {
  quota: "over quota",
  rate_limit: "rate limited",
  bad_request: "request rejected",
  timeout: "timed out",
  auth: "API key rejected",
  server_error: "provider error",
  network: "network error",
  empty: "empty answer",
};

const CHANGE_WORDS = {
  enabled: "switched on",
  plan: "plan",
  position: "place in the order",
  priceInput: "input price",
  priceOutput: "output price",
  pricesCheckedAt: "prices checked",
  monthlyCapUsd: "monthly cap",
  rpmLimit: "requests a minute",
  tpmLimit: "tokens a minute",
  dailyLimit: "requests a day",
  "settings.monthlyCapUsd": "overall monthly cap",
  "settings.alertPercent": "alert level",
  "settings.messagesPerCustomerHour": "messages per customer an hour",
  "settings.messagesPerIpHour": "messages per visitor an hour",
  "settings.maxMessageChars": "longest message",
  "settings.liveCustomerMode": "Live customer mode",
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KL = "Asia/Kuala_Lumpur";

// ── Formatting ─────────────────────────────────────────────────────────

/** Money for people: cents are enough, tiny amounts say so. */
function usd(v) {
  if (v === null || v === undefined) return "–";
  const n = Number(v);
  if (n > 0 && n < 0.01) return "under USD 0.01";
  return `USD ${n.toFixed(2)}`;
}

const usdExact = (v) => `USD ${Number(v || 0).toFixed(4)}`;
const int = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString("en-MY"));
const when = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: KL }) : "–");
const clock = (v) => (v ? new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: KL }) : "–");
const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: KL }) : "–");
const shortDay = (key) => new Date(`${key}T00:00:00+08:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: KL });

function percent(used, cap) {
  if (!cap) return null;
  const p = ((used || 0) / cap) * 100;
  if (p > 0 && p < 1) return "under 1%";
  return `${Math.round(p)}%`;
}

const klKey = (d) => new Date(d.getTime() + 8 * HOUR_MS).toISOString().slice(0, 10);

function apiError(err, fallback) {
  return { text: err?.response?.data?.message || fallback, code: err?.response?.data?.code, blockers: err?.response?.data?.details?.blockers };
}

// ── Small parts ────────────────────────────────────────────────────────

function Pill({ tone, children }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

function Meter({ value, max, level, label }) {
  const pct = max ? Math.min(100, ((value || 0) / max) * 100) : 0;
  return (
    <span className={styles.meter} data-level={level} role="meter" aria-valuemin={0} aria-valuemax={max || 0} aria-valuenow={value || 0} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

function levelFor(used, limit, alertPercent = 80) {
  if (!limit) return "ok";
  const share = ((used || 0) / limit) * 100;
  if (share >= 100) return "bad";
  if (share >= alertPercent) return "warn";
  return "ok";
}

/** A line of feedback next to the control that caused it. */
function Feedback({ message }) {
  if (!message) return <span className={styles.feedback} role="status" aria-live="polite" />;
  const Icon = message.tone === "bad" ? XCircle : CheckCircle2;
  return (
    <span className={styles.feedback} data-tone={message.tone} role={message.tone === "bad" ? "alert" : "status"} aria-live="polite">
      <Icon size={15} aria-hidden="true" /> {message.text}
    </span>
  );
}

function Callout({ tone, icon: Icon = AlertTriangle, children }) {
  return (
    <div className={styles.callout} data-tone={tone} role={tone === "bad" ? "alert" : undefined}>
      <Icon size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** A number input with its unit beside it and its hint and error linked. */
function NumberField({ label, unit, hint, error, value, onChange, disabled, placeholder, inputRef, decimal = true }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.inputWrap} data-invalid={error ? "" : undefined}>
        <input
          id={id}
          ref={inputRef}
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      {error && (
        <small id={errorId} className={styles.fieldError}>
          {error}
        </small>
      )}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}

/** A native modal dialog: focus is held inside, Esc closes it. */
function ConfirmDialog({ open, title, children, confirmLabel, tone = "primary", busy, onConfirm, onCancel }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className={styles.dialogBody}>{children}</div>
      <div className={styles.dialogBar}>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={tone === "danger" ? styles.danger : styles.primary} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 size={15} className={styles.spin} aria-hidden="true" />} {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

// ── Status: what customers get right now ───────────────────────────────

function headlineFor(data, answering) {
  const capReached = data.settings.saved && data.settings.monthlyCapUsd !== null && data.spend.monthUsd >= data.settings.monthlyCapUsd;
  if (data.breaker.open) {
    return {
      tone: "bad",
      title: `AI answers are paused until ${clock(data.breaker.openUntil)}`,
      text: `${data.breaker.reason === "all_failed" ? "Every model failed on one message" : "Too many calls failed in a row"}. Customers get the quick topics and fixed answers meanwhile.`,
    };
  }
  if (capReached) {
    return {
      tone: "bad",
      title: "The monthly cap is reached",
      text: "Customers get the quick topics and fixed answers until the 1st of next month, or until the cap is raised.",
    };
  }
  if (!data.models.some((m) => m.enabled)) {
    return { tone: "warn", title: "No model is switched on", text: "Customers get the quick topics and fixed answers only." };
  }
  if (!answering.length) {
    return { tone: "bad", title: "No switched-on model can answer right now", text: "Customers get the quick topics and fixed answers until one recovers. Check each model's status below." };
  }
  const [first, second] = answering;
  return {
    tone: data.liveMode ? "ok" : "warn",
    title: `Customers get AI answers from ${first.displayName}`,
    text: second ? `If it fails, ${second.displayName} answers the same message straight away.` : "There is no backup model: if it fails, customers get the quick topics.",
  };
}

function StatusPanel({ data, answering, asOf, onLive }) {
  const headline = headlineFor(data, answering);
  const enabled = data.models.filter((m) => m.enabled);
  const cap = data.settings.monthlyCapUsd;
  const spent = data.spend.monthUsd;

  // Spend so far, carried to the end of the Malaysia-time month.
  const pace = useMemo(() => {
    const start = new Date(data.spend.monthStart).getTime();
    const now = asOf.getTime();
    const kl = new Date(now + 8 * HOUR_MS);
    const daysInMonth = new Date(Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth() + 1, 0)).getUTCDate();
    const elapsedDays = Math.max(1, (now - start) / DAY_MS);
    return (spent / elapsedDays) * daysInMonth;
  }, [data.spend.monthStart, spent, asOf]);

  const blockers = data.liveBlockers || [];
  const liveReason = !data.settings.saved
    ? "Save the cost controls first."
    : blockers.length
      ? `${blockers.length === 1 ? "1 switched-on model stops" : `${blockers.length} switched-on models stop`} it:`
      : null;

  return (
    <section className={styles.status} data-tone={headline.tone} aria-labelledby="ai-status-title">
      <div className={styles.headline}>
        <h2 id="ai-status-title">{headline.title}</h2>
        <p>{headline.text}</p>
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <h3>Answering order</h3>
          {enabled.length ? (
            <ol className={styles.chain}>
              {enabled.map((m) => {
                const s = STATUS[m.status] || STATUS.off;
                return (
                  <li key={m.id}>
                    <span className={styles.chainName}>{m.displayName}</span>
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.muted}>Nothing switched on.</p>
          )}
        </div>

        <div className={styles.fact}>
          <h3>Spend this month</h3>
          {data.settings.saved && cap !== null ? (
            <>
              <p className={styles.factFigure}>
                {usd(spent)} <span>of {usd(cap)}</span>
              </p>
              <Meter value={spent} max={cap} level={levelFor(spent, cap, data.settings.alertPercent)} label="Spend against the monthly cap" />
              <p className={styles.muted}>
                {percent(spent, cap) ?? "0%"} used · on pace for {usd(pace)} · alert email at {data.settings.alertPercent}%
              </p>
            </>
          ) : (
            <p className={styles.muted}>{usd(spent)} so far. No monthly cap is saved yet.</p>
          )}
        </div>

        <div className={styles.fact}>
          <h3>Live customer mode</h3>
          <p className={styles.liveState} data-on={data.liveMode ? "" : undefined}>
            <ShieldCheck size={17} aria-hidden="true" /> {data.liveMode ? "On" : "Off"}
          </p>
          <p className={styles.muted}>
            {data.liveMode
              ? "Only paid models with a passing test for the current prompt can answer customers."
              : "Free and untested models may answer. Fine for development and demos; turn this on before real customers use the chat."}
          </p>
          {!data.liveMode && liveReason && (
            <div id="ai-live-reason" className={styles.blockers}>
              <p>{liveReason}</p>
              {blockers.length > 0 && (
                <ul>
                  {blockers.map((b) => (
                    <li key={b.id}>
                      <strong>{b.displayName}</strong>: {b.reason.replace(/^Live customer mode is on: /, "")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            className={data.liveMode ? styles.secondary : styles.primary}
            onClick={() => onLive(!data.liveMode)}
            disabled={!data.liveMode && Boolean(liveReason)}
            aria-describedby={!data.liveMode && liveReason ? "ai-live-reason" : undefined}
          >
            {data.liveMode ? "Turn Live mode off…" : "Turn Live mode on…"}
          </button>
          <p className={styles.fine}>Prompt version {data.promptVersion}</p>
        </div>
      </div>
    </section>
  );
}

// ── Models ─────────────────────────────────────────────────────────────

function ModelEditor({ model, onSave, onPricesChecked }) {
  const [form, setForm] = useState({
    priceInput: model.prices.input ?? "",
    priceOutput: model.prices.output ?? "",
    monthlyCapUsd: model.cap.monthlyUsd ?? "",
    rpmLimit: model.limits.rpm ?? "",
    tpmLimit: model.limits.tpm ?? "",
    dailyLimit: model.limits.daily ?? "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const firstField = useRef(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const validate = () => {
    const next = {};
    ["priceInput", "priceOutput"].forEach((k) => {
      const n = Number(form[k]);
      if (form[k] === "" || !Number.isFinite(n) || n < 0) next[k] = "Enter a price of 0 or more.";
    });
    if (form.monthlyCapUsd !== "" && !(Number(form.monthlyCapUsd) >= 0)) next.monthlyCapUsd = "Enter an amount of 0 or more, or leave it empty.";
    ["rpmLimit", "tpmLimit", "dailyLimit"].forEach((k) => {
      if (form[k] !== "" && !(Number.isInteger(Number(form[k])) && Number(form[k]) >= 1)) next[k] = "Enter a whole number of 1 or more, or leave it empty.";
    });
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!validate()) return;
    setBusy(true);
    const result = await onSave(form);
    setBusy(false);
    setMessage(result.ok ? { tone: "ok", text: "Saved." } : { tone: "bad", text: result.text });
  };

  const pricesOk = async () => {
    setBusy(true);
    const result = await onPricesChecked();
    setBusy(false);
    setMessage(result.ok ? { tone: "ok", text: "Prices marked as checked today." } : { tone: "bad", text: result.text });
  };

  return (
    <form className={styles.editor} onSubmit={save} noValidate>
      <fieldset>
        <legend>Prices per million tokens</legend>
        <NumberField label="Input" unit="USD" value={form.priceInput} onChange={set("priceInput")} disabled={busy} error={errors.priceInput} inputRef={firstField} />
        <NumberField label="Output" unit="USD" value={form.priceOutput} onChange={set("priceOutput")} disabled={busy} error={errors.priceOutput} />
        <p className={model.prices.stale ? styles.warnText : styles.muted}>
          Last checked {day(model.prices.checkedAt)}
          {model.prices.stale ? ", over 60 days ago" : ""}.
        </p>
        <button type="button" className={styles.secondarySmall} onClick={pricesOk} disabled={busy}>
          Mark prices as checked
        </button>
      </fieldset>
      <fieldset>
        <legend>This model's monthly cap</legend>
        <NumberField
          label="Cap"
          unit="USD / month"
          placeholder="No cap"
          value={form.monthlyCapUsd}
          onChange={set("monthlyCapUsd")}
          disabled={busy}
          error={errors.monthlyCapUsd}
          hint="Leave empty for no cap. At the cap this model is skipped until next month and the next one answers."
        />
      </fieldset>
      <fieldset>
        <legend>Provider limits, from the plan</legend>
        <NumberField label="Requests" unit="/ minute" placeholder="No limit" decimal={false} value={form.rpmLimit} onChange={set("rpmLimit")} disabled={busy} error={errors.rpmLimit} />
        <NumberField label="Tokens" unit="/ minute" placeholder="No limit" decimal={false} value={form.tpmLimit} onChange={set("tpmLimit")} disabled={busy} error={errors.tpmLimit} />
        <NumberField
          label="Requests"
          unit="/ day"
          placeholder="No limit"
          decimal={false}
          value={form.dailyLimit}
          onChange={set("dailyLimit")}
          disabled={busy}
          error={errors.dailyLimit}
          hint="Free plans usually have a daily limit."
        />
      </fieldset>
      <div className={styles.formBar}>
        <Feedback message={message} />
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy && <Loader2 size={15} className={styles.spin} aria-hidden="true" />} Save changes
        </button>
      </div>
    </form>
  );
}

function ModelsSection({ data, answering, act }) {
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rowMessage, setRowMessage] = useState(null); // { id, tone, text }
  const [drag, setDrag] = useState(null); // { id, from, over, startY, dy, height }
  const [pendingOrder, setPendingOrder] = useState(null); // ids shown while a new order saves
  const [announce, setAnnounce] = useState("");
  const bodyRef = useRef(null);
  const mids = useRef([]);
  const dragRef = useRef(null);
  const focusAfter = useRef(null);
  const hintId = useId();
  const saved = data.models;
  // A new order shows straight away; the saved order comes back on refresh.
  const models = pendingOrder ? pendingOrder.map((id) => saved.find((m) => m.id === id)).filter(Boolean) : saved;
  const firstId = answering[0]?.id;

  // After a reorder is saved the rows re-render: put focus back on the moved
  // model's handle.
  useEffect(() => {
    if (focusAfter.current === null) return;
    const id = focusAfter.current;
    focusAfter.current = null;
    bodyRef.current?.querySelector(`[data-handle="${id}"]`)?.focus();
  }, [saved]);

  const runRow = async (id, fn, fallback, okText) => {
    setBusyId(id);
    setRowMessage(null);
    const result = await act(fn, fallback);
    setBusyId(null);
    setRowMessage(result.ok ? (okText ? { id, tone: "ok", text: okText } : null) : { id, tone: "bad", text: result.text });
    return result;
  };

  // `ids` is the full new order with model `id` in its new place.
  const saveOrder = async (id, ids) => {
    const name = models.find((m) => m.id === id)?.displayName;
    focusAfter.current = id;
    setPendingOrder(ids);
    const result = await runRow(id, () => reorderAiModels(ids), "The order couldn't be saved.");
    setPendingOrder(null);
    setAnnounce(result.ok ? `${name} moved to position ${ids.indexOf(id) + 1} of ${ids.length}.` : "The order couldn't be saved.");
  };

  const canReorder = busyId === null && models.length > 1;

  // Keyboard: focus the handle and press the up or down arrow key.
  const onHandleKey = (e, index) => {
    if (e.key === "Escape" && dragRef.current) {
      cancelDrag();
      return;
    }
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = index + step;
    if (!canReorder || dragRef.current || to < 0 || to >= models.length) return;
    const ids = models.map((m) => m.id);
    const [id] = ids.splice(index, 1);
    ids.splice(to, 0, id);
    saveOrder(id, ids);
  };

  // Pointer (mouse, pen or touch): hold the handle and move up or down. The
  // dragged row follows the pointer and the rows it passes slide out of the
  // way, so the gap shows where it will land. A row moves aside once the
  // dragged row's middle passes that row's middle. Positions are measured
  // once at the start (with any open editor closed first), so the rows
  // sliding don't change where the drop lands. `over` is where the model
  // would go among the other rows.
  const onPointerDown = (e, index, id) => {
    if (e.button !== 0 || !canReorder) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (open !== null) flushSync(() => setOpen(null));
    const rows = [...bodyRef.current.querySelectorAll("tr[data-row-id]")];
    const middle = (row) => {
      const box = row.getBoundingClientRect();
      return box.top + window.scrollY + box.height / 2;
    };
    const own = rows.find((row) => row.dataset.rowId === String(id));
    mids.current = rows.filter((row) => row !== own).map(middle);
    dragRef.current = { id, from: index, over: index, startY: e.pageY, dy: 0, centre: middle(own), height: own.offsetHeight };
    setDrag(dragRef.current);
  };

  // The handlers read dragRef, not `drag`: a quick flick can send the move
  // and the release before React has re-rendered with the drag started.
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.pageY - d.startY;
    dragRef.current = { ...d, dy, over: mids.current.filter((mid) => mid < d.centre + dy).length };
    setDrag(dragRef.current);
  };

  // How far row `index` is moved while dragging: the dragged row follows the
  // pointer; the rows between its old and new place slide by its height.
  const shiftFor = (index) => {
    if (!drag) return 0;
    const { from, over, dy, height } = drag;
    if (index === from) return dy;
    if (index > from && index <= over) return -height;
    if (index < from && index >= over) return height;
    return 0;
  };

  // The order number a row would have if dropped now.
  const positionFor = (index) => {
    if (!drag) return index + 1;
    const { from, over } = drag;
    if (index === from) return over + 1;
    if (index > from && index <= over) return index;
    if (index < from && index >= over) return index + 2;
    return index + 1;
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    onPointerMove(e);
    const { id, from, over } = dragRef.current;
    cancelDrag();
    if (over === from) return;
    const ids = models.map((m) => m.id).filter((x) => x !== id);
    ids.splice(over, 0, id);
    saveOrder(id, ids);
  };

  return (
    <section className={styles.section} aria-labelledby="ai-models-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-models-title">Models</h2>
        <p>Tried in this order. The first switched-on model answers; if it fails, the next one gets the same message straight away. Drag a model by its handle to change the order.</p>
      </header>
      <p id={hintId} className={styles.srOnly}>
        Drag the handle, or focus it and press the up or down arrow key.
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>

      {models.length === 0 ? (
        <div className={styles.empty}>
          <p>
            <strong>No AI models are set up.</strong>
          </p>
          <p className={styles.muted}>Models are added by the chatbot seed script on the server. Until then customers get the quick topics and fixed answers.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Model</th>
                <th scope="col">On</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Last test</th>
                <th scope="col">This month</th>
              </tr>
            </thead>
            <tbody ref={bodyRef} data-sorting={drag ? "" : undefined}>
              {models.map((m, i) => {
                const status = STATUS[m.status] || STATUS.off;
                const busy = busyId === m.id;
                const msg = rowMessage?.id === m.id ? rowMessage : null;
                const editorId = `ai-model-editor-${m.id}`;
                const dragging = drag?.id === m.id;
                const shift = shiftFor(i);
                return [
                  <tr
                    key={m.id}
                    data-row-id={m.id}
                    data-off={m.enabled ? undefined : ""}
                    data-dragging={dragging ? "" : undefined}
                    style={shift ? { transform: `translateY(${shift}px)` } : undefined}
                    aria-busy={busy || undefined}
                  >
                    <td data-label="Order">
                      <span className={styles.order}>
                        <button
                          type="button"
                          className={styles.handle}
                          data-handle={m.id}
                          aria-label={`Reorder ${m.displayName}, position ${i + 1} of ${models.length}`}
                          aria-describedby={hintId}
                          title="Drag to change the order"
                          disabled={!canReorder}
                          onPointerDown={(e) => onPointerDown(e, i, m.id)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onPointerCancel={cancelDrag}
                          onKeyDown={(e) => onHandleKey(e, i)}
                        >
                          <GripVertical size={18} aria-hidden="true" />
                        </button>
                        <span className={styles.orderNum}>{positionFor(i)}</span>
                      </span>
                    </td>
                    <th scope="row" className={styles.modelCell}>
                      <span className={styles.modelName}>
                        {m.displayName}
                        {m.id === firstId && <span className={styles.firstTag}>Answers first</span>}
                      </span>
                      <span className={styles.sub}>
                        {m.provider.toLowerCase()} · {m.modelName}
                      </span>
                      <span className={styles.sub} data-tone={m.keyPresent ? undefined : "bad"}>
                        <KeyRound size={13} aria-hidden="true" /> {m.keyPresent ? "API key set" : "API key missing on the server"}
                      </span>
                      {!m.enabled && m.enableBlocker && <span className={styles.warnText}>{m.enableBlocker.replace(/^Live customer mode is on: /, "Can't switch on in Live mode: ")}</span>}
                      <button
                        type="button"
                        className={styles.disclose}
                        onClick={() => setOpen(open === m.id ? null : m.id)}
                        aria-expanded={open === m.id}
                        aria-controls={open === m.id ? editorId : undefined}
                      >
                        Prices, cap and limits
                        <ChevronRight size={15} aria-hidden="true" className={styles.chevron} data-open={open === m.id ? "" : undefined} />
                      </button>
                      <Feedback message={msg} />
                    </th>
                    <td data-label="On">
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          disabled={busyId !== null || (!m.enabled && Boolean(m.enableBlocker))}
                          onChange={(e) =>
                            runRow(m.id, () => updateAiModel(m.id, { enabled: e.target.checked }), "The model couldn't be switched.", e.target.checked ? "Switched on." : "Switched off.")
                          }
                          aria-label={`${m.displayName} switched on`}
                        />
                        <span aria-hidden="true" />
                      </label>
                    </td>
                    <td data-label="Plan">
                      <select
                        className={styles.select}
                        value={m.plan}
                        disabled={busyId !== null}
                        aria-label={`${m.displayName} plan`}
                        onChange={(e) => runRow(m.id, () => updateAiModel(m.id, { plan: e.target.value }), "The plan couldn't be saved.", "Plan saved.")}
                      >
                        <option value="FREE">Free</option>
                        <option value="PAID">Paid</option>
                      </select>
                    </td>
                    <td data-label="Status">
                      <Pill tone={status.tone}>{status.label}</Pill>
                      {m.status === "skipped" && <span className={styles.sub}>until {when(m.skippedUntil)}</span>}
                      {m.status === "failing" && <span className={styles.sub}>{m.consecutiveFailures} failed in a row</span>}
                    </td>
                    <td data-label="Last test">
                      {m.test.score === null ? (
                        <>
                          <Pill tone={m.enabled ? "warn" : "muted"}>Not tested</Pill>
                          {m.enabled && <span className={styles.sub}>Not for real customers yet</span>}
                        </>
                      ) : (
                        <>
                          <Pill tone={m.test.passed ? "ok" : "bad"}>
                            {m.test.score}% {m.test.passed ? "passed" : "failed"}
                          </Pill>
                          <span className={styles.sub}>
                            {day(m.test.at)}
                            {m.test.promptVersion !== data.promptVersion ? " · older prompt" : ""}
                          </span>
                        </>
                      )}
                    </td>
                    <td data-label="This month" className={styles.num}>
                      {int(m.usage.month.requests)} answers
                      <span className={styles.sub}>
                        {usd(m.usage.month.costUsd)}
                        {m.cap.monthlyUsd !== null ? ` of ${usd(m.cap.monthlyUsd)}` : ""}
                      </span>
                    </td>
                  </tr>,
                  open === m.id && (
                    <tr key={`${m.id}-edit`} className={styles.editRow} id={editorId}>
                      <td colSpan={7}>
                        <ModelEditor
                          model={m}
                          onSave={(form) => act(() => updateAiModel(m.id, form), "The model couldn't be saved.")}
                          onPricesChecked={() => act(() => confirmAiPrices(m.id), "Couldn't mark the prices as checked.")}
                        />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Cost controls ──────────────────────────────────────────────────────

const SETTING_KEYS = ["monthlyCapUsd", "alertPercent", "messagesPerCustomerHour", "messagesPerIpHour", "maxMessageChars"];

// 0 on the server means "no limit" for the customer limits; the page shows
// that as an empty field, so empty means "no limit" everywhere on the page.
function formFromSettings(s) {
  return {
    monthlyCapUsd: s.monthlyCapUsd ?? "",
    alertPercent: String(s.alertPercent ?? ""),
    messagesPerCustomerHour: s.messagesPerCustomerHour ? String(s.messagesPerCustomerHour) : "",
    messagesPerIpHour: s.messagesPerIpHour ? String(s.messagesPerIpHour) : "",
    maxMessageChars: String(s.maxMessageChars ?? ""),
  };
}

function SettingsSection({ data, act }) {
  const saved = useMemo(() => formFromSettings(data.settings), [data.settings]);
  const [draft, setDraft] = useState(null); // null: showing the saved values
  const form = draft ?? saved;
  const dirty = draft !== null && SETTING_KEYS.some((k) => String(draft[k]) !== String(saved[k]));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, text }
  const set = (key) => (e) => {
    setMessage(null);
    setDraft({ ...form, [key]: e.target.value });
  };

  const validate = () => {
    const next = {};
    const cap = Number(form.monthlyCapUsd);
    if (form.monthlyCapUsd === "" || !Number.isFinite(cap) || cap < 0) next.monthlyCapUsd = "Enter the most to spend on AI a month, in USD.";
    const alert = Number(form.alertPercent);
    if (!Number.isInteger(alert) || alert < 1 || alert > 100) next.alertPercent = "Enter a whole number from 1 to 100.";
    ["messagesPerCustomerHour", "messagesPerIpHour"].forEach((k) => {
      if (form[k] !== "" && !(Number.isInteger(Number(form[k])) && Number(form[k]) >= 1 && Number(form[k]) <= 1000)) next[k] = "Enter a whole number from 1 to 1,000, or leave it empty for no limit.";
    });
    const chars = Number(form.maxMessageChars);
    if (!Number.isInteger(chars) || chars < 50 || chars > 4000) next.maxMessageChars = "Enter a whole number from 50 to 4,000.";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const doSave = async () => {
    setBusy(true);
    setMessage(null);
    const body = {
      ...form,
      messagesPerCustomerHour: form.messagesPerCustomerHour === "" ? 0 : form.messagesPerCustomerHour,
      messagesPerIpHour: form.messagesPerIpHour === "" ? 0 : form.messagesPerIpHour,
    };
    const result = await act(() => updateAiSettings(body), "The settings couldn't be saved.");
    setBusy(false);
    setConfirm(null);
    if (result.ok) {
      setDraft(null);
      setMessage({ tone: "ok", text: "Saved." });
    } else {
      setMessage({ tone: "bad", text: result.text });
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) {
      setMessage({ tone: "bad", text: "Check the highlighted fields." });
      return;
    }
    const cap = Number(form.monthlyCapUsd);
    if (cap === 0) {
      setConfirm({ title: "Turn AI answers off?", action: "Turn AI answers off", text: "A monthly cap of USD 0 turns AI answers off for every customer. They get the quick topics and fixed answers until the cap is raised." });
    } else if (cap <= data.spend.monthUsd && cap !== Number(saved.monthlyCapUsd)) {
      setConfirm({
        title: "Stop AI answers for this month?",
        action: "Save and stop AI answers",
        text: `${usd(data.spend.monthUsd)} is already spent this month, so a cap of ${usd(cap)} is reached straight away. Customers get the quick topics and fixed answers until the 1st.`,
      });
    } else {
      doSave();
    }
  };

  const hits = data.limitHits;

  return (
    <section className={styles.section} aria-labelledby="ai-settings-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-settings-title">Cost controls and customer limits</h2>
        <p>Typed messages that go to the AI count. Quick topics, buttons and messages to a support ticket are always free.</p>
      </header>
      {!data.settings.saved && (
        <Callout tone="warn">No cost controls are saved yet. Live customer mode stays off until they are.</Callout>
      )}
      <form onSubmit={submit} className={styles.settings} noValidate>
        <fieldset>
          <legend>Monthly spend</legend>
          <NumberField
            label="Overall monthly cap"
            unit="USD / month"
            value={form.monthlyCapUsd}
            onChange={set("monthlyCapUsd")}
            disabled={busy}
            error={errors.monthlyCapUsd}
            hint="At the cap, the chatbot uses quick topics and fixed answers only until the 1st of next month."
          />
          <NumberField
            label="Alert email at"
            unit="% of a cap"
            decimal={false}
            value={form.alertPercent}
            onChange={set("alertPercent")}
            disabled={busy}
            error={errors.alertPercent}
            hint="Sent when the overall cap, a model's cap or a provider limit reaches this share."
          />
        </fieldset>
        <fieldset>
          <legend>Customer limits</legend>
          <NumberField
            label="Signed-in customer"
            unit="AI messages / hour"
            placeholder="No limit"
            decimal={false}
            value={form.messagesPerCustomerHour}
            onChange={set("messagesPerCustomerHour")}
            disabled={busy}
            error={errors.messagesPerCustomerHour}
          />
          <NumberField
            label="Visitor, per IP address"
            unit="AI messages / hour"
            placeholder="No limit"
            decimal={false}
            value={form.messagesPerIpHour}
            onChange={set("messagesPerIpHour")}
            disabled={busy}
            error={errors.messagesPerIpHour}
            hint="Leave a limit empty for no limit."
          />
          <NumberField
            label="Longest message"
            unit="characters"
            decimal={false}
            value={form.maxMessageChars}
            onChange={set("maxMessageChars")}
            disabled={busy}
            error={errors.maxMessageChars}
          />
          <p className={styles.muted}>
            This week {int(hits.customers)} customer{hits.customers === 1 ? "" : "s"} and {int(hits.visitorChats)} visitor chat{hits.visitorChats === 1 ? "" : "s"} hit a limit
            ({int(hits.messagesHeld)} message{hits.messagesHeld === 1 ? "" : "s"} held back). {int(hits.capHeldMessages)} {hits.capHeldMessages === 1 ? "was" : "were"} held back by
            the monthly cap.
          </p>
        </fieldset>
        <div className={styles.formBar}>
          <Feedback message={message} />
          {dirty && !busy && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                setDraft(null);
                setErrors({});
                setMessage(null);
              }}
            >
              Discard changes
            </button>
          )}
          <button type="submit" className={styles.primary} disabled={busy || (!dirty && data.settings.saved)}>
            {busy && <Loader2 size={15} className={styles.spin} aria-hidden="true" />} Save settings
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        confirmLabel={confirm?.action}
        tone="danger"
        busy={busy}
        onConfirm={doSave}
        onCancel={() => setConfirm(null)}
      >
        <p>{confirm?.text}</p>
      </ConfirmDialog>
    </section>
  );
}

// ── Monitoring ─────────────────────────────────────────────────────────

function UsageSection({ data, asOf }) {
  // Every day of the last 30 in Malaysia time, so quiet days show as gaps
  // rather than disappearing.
  const chart = useMemo(() => {
    const byDay = new Map();
    data.daily.forEach((r) => {
      const row = byDay.get(r.day) || {};
      row[`m${r.modelId}`] = r.costUsd;
      byDay.set(r.day, row);
    });
    const rows = [];
    for (let i = 29; i >= 0; i -= 1) {
      const key = klKey(new Date(asOf.getTime() - i * DAY_MS));
      rows.push({ day: shortDay(key), ...(byDay.get(key) || {}) });
    }
    return rows;
  }, [data.daily, asOf]);

  return (
    <section className={styles.section} aria-labelledby="ai-usage-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-usage-title">Usage</h2>
        <p>Estimated from the tokens each provider reports. The real bills stay in each provider's console.</p>
      </header>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.plain}`}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col" className={styles.num}>
                Today
              </th>
              <th scope="col" className={styles.num}>
                This month
              </th>
              <th scope="col" className={styles.num}>
                Tokens in / out this month
              </th>
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.displayName}</th>
                <td className={styles.num}>
                  {int(m.usage.today.requests)} answers · {usd(m.usage.today.costUsd)}
                </td>
                <td className={styles.num}>
                  {int(m.usage.month.requests)} answers · {usd(m.usage.month.costUsd)}
                </td>
                <td className={styles.num}>
                  {int(m.usage.month.inputTokens)} / {int(m.usage.month.outputTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={styles.subHead}>Estimated cost per day in USD, last 30 days</h3>
      {data.daily.length ? (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" fontSize={12} tick={{ fill: "#475569" }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis fontSize={12} tick={{ fill: "#475569" }} width={52} allowDecimals tickCount={4} tickFormatter={(v) => Number(v).toFixed(v > 0 && v < 0.1 ? 3 : 2)} />
              <Tooltip formatter={(v) => usdExact(v)} />
              <Legend formatter={(value) => <span className={styles.legendText}>{value}</span>} />
              {data.models.map((m, i) => (
                <Bar key={m.id} dataKey={`m${m.id}`} name={m.displayName} stackId="cost" fill={SERIES[i % SERIES.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={styles.muted}>No AI answers in the last 30 days.</p>
      )}
    </section>
  );
}

function LimitsSection({ data }) {
  const enabled = data.models.filter((m) => m.enabled);
  const row = (label, used, limit) => (
    <div className={styles.limitRow}>
      <span>{label}</span>
      {limit ? (
        <>
          <span className={styles.num}>
            {int(used)} of {int(limit)}
          </span>
          <Meter value={used} max={limit} level={levelFor(used, limit, data.settings.alertPercent)} label={`${label}: ${int(used)} of ${int(limit)}`} />
        </>
      ) : (
        <span className={styles.muted}>No limit set</span>
      )}
    </div>
  );
  return (
    <section className={styles.section} aria-labelledby="ai-limits-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-limits-title">Provider limits</h2>
        <p>Counted in answers. One answer can make up to 4 AI calls, so the real figure can be higher.</p>
      </header>
      {enabled.length ? (
        <div className={styles.limits}>
          {enabled.map((m) => (
            <div key={m.id} className={styles.limitBlock}>
              <h3>{m.displayName}</h3>
              {row("Requests this minute", m.limits.use.rpm, m.limits.rpm)}
              {row("Tokens this minute", m.limits.use.tpm, m.limits.tpm)}
              {row("Requests today", m.limits.use.today, m.limits.daily)}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>No model is switched on.</p>
      )}
    </section>
  );
}

function HealthSection({ data }) {
  const h = data.health;
  const errors = Object.entries(h.errorsByType);
  const secs = (ms) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
  const stats = [
    ["AI answers", int(h.answers)],
    ["Median reply", secs(h.medianMs)],
    ["Slowest reply", secs(h.slowestMs)],
    ["Handed to the next model", int(h.switches)],
    ["Failed the answer check", int(h.checkFailures)],
    ["Fell back to quick topics", int(h.fallbacks)],
  ];
  return (
    <section className={styles.section} aria-labelledby="ai-health-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-health-title">Health, last 7 days</h2>
      </header>
      <dl className={styles.stats}>
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.muted}>
        {errors.length
          ? `Failed calls: ${errors.map(([type, n]) => `${n} ${ERROR_WORDS[type] || type.replace(/_/g, " ")}`).join(", ")}.`
          : "No failed calls."}
      </p>
    </section>
  );
}

function changeText(c) {
  const what = CHANGE_WORDS[c.field] || c.field;
  if (c.field === "pricesCheckedAt") return `marked ${c.model ? `${c.model}'s ` : ""}prices as checked`;
  if (c.field === "enabled") return `switched ${c.model || "a model"} ${c.newValue === "true" ? "on" : "off"}`;
  if (c.field === "settings.liveCustomerMode") return `turned Live customer mode ${c.newValue === "true" ? "on" : "off"}`;
  const from = c.oldValue === null || c.oldValue === "" ? "empty" : c.oldValue;
  const to = c.newValue === null || c.newValue === "" ? "empty" : c.newValue;
  return `changed ${c.model ? `${c.model}'s ` : "the "}${what} from ${from} to ${to}`;
}

function LogSection({ data }) {
  return (
    <section className={styles.section} aria-labelledby="ai-log-title">
      <header className={styles.sectionHead}>
        <h2 id="ai-log-title">History</h2>
      </header>
      <details className={styles.disclosure}>
        <summary>
          Recent alerts <span className={styles.count}>{data.alerts.length}</span>
          <span className={styles.summaryHint}>emailed to the admins</span>
        </summary>
        {data.alerts.length ? (
          <ul className={styles.log}>
            {data.alerts.map((a) => (
              <li key={a.id}>
                <time className={styles.logWhen}>{when(a.at)}</time>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No alerts yet.</p>
        )}
      </details>
      <details className={styles.disclosure}>
        <summary>
          Recent changes <span className={styles.count}>{data.changes.length}</span>
        </summary>
        {data.changes.length ? (
          <ul className={styles.log}>
            {data.changes.map((c) => (
              <li key={c.id}>
                <time className={styles.logWhen}>{when(c.at)}</time>
                <span>
                  <strong>{c.by || "Someone"}</strong> {changeText(c)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No changes yet.</p>
        )}
      </details>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function AiModels() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [live, setLive] = useState(null); // { on, busy, error, blockers }

  useEffect(() => {
    let cancelled = false;
    getAiOverview()
      .then(({ data: overview }) => {
        if (cancelled) return;
        setData(overview);
        setUpdatedAt(new Date());
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiError(err, "The AI models couldn't be loaded.").text);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetches again without blanking the page.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: overview } = await getAiOverview();
      setData(overview);
      setLoadError("");
      setUpdatedAt(new Date());
    } catch (err) {
      setLoadError(apiError(err, "The AI models couldn't be loaded.").text);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /** Runs a change, then refreshes. Resolves { ok } or { ok: false, text }. */
  const act = useCallback(
    async (fn, fallback) => {
      try {
        await fn();
      } catch (err) {
        return { ok: false, ...apiError(err, fallback) };
      }
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const answering = useMemo(() => (data ? data.models.filter((m) => m.enabled && m.status === "active") : []), [data]);

  const confirmLive = async () => {
    setLive((l) => ({ ...l, busy: true, error: null }));
    try {
      await setAiLiveMode(live.on);
      await refresh();
      setLive(null);
    } catch (err) {
      const e = apiError(err, "Live customer mode couldn't be changed.");
      setLive((l) => ({ ...l, busy: false, error: e.text, blockers: e.blockers }));
    }
  };

  const liveModels = data ? data.models.filter((m) => m.enabled) : [];

  return (
    <main className={`master-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <div>
          <p>Which AI models answer the customer chatbot, in what order, and what they cost. API keys stay on the server and never appear here.</p>
        </div>
        <div className={styles.refresh}>
          {updatedAt && <span className={styles.fine}>Updated {clock(updatedAt)}</span>}
          <button type="button" className={styles.secondary} onClick={refresh} disabled={refreshing}>
            <RefreshCw size={15} aria-hidden="true" className={refreshing ? styles.spin : undefined} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {loadError && (
        <Callout tone="bad" icon={XCircle}>
          <strong>{loadError}</strong>{" "}
          <button type="button" className={styles.inlineLink} onClick={refresh}>
            Try again
          </button>
        </Callout>
      )}

      {!data && !loadError && (
        <div className={styles.loading} role="status">
          <Loader2 size={18} className={styles.spin} aria-hidden="true" /> Loading the AI models…
        </div>
      )}

      {data && (
        <div className={styles.stack} aria-busy={refreshing || undefined}>
          <StatusPanel data={data} answering={answering} asOf={updatedAt} onLive={(on) => setLive({ on })} />

          {data.models.some((m) => m.enabled && m.prices.stale) && (
            <Callout tone="info" icon={Info}>
              Prices for {data.models.filter((m) => m.enabled && m.prices.stale).map((m) => m.displayName).join(", ")} were last checked over 60 days ago. Open the
              model's prices and limits to check them.
            </Callout>
          )}

          <ModelsSection data={data} answering={answering} act={act} />
          <SettingsSection data={data} act={act} />
          <UsageSection data={data} asOf={updatedAt} />
          <div className={styles.twoCol}>
            <LimitsSection data={data} />
            <HealthSection data={data} />
          </div>
          <LogSection data={data} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(live)}
        title={live?.on ? "Turn Live customer mode on?" : "Turn Live customer mode off?"}
        confirmLabel={live?.on ? "Turn on" : "Turn off"}
        tone={live?.on ? "primary" : "danger"}
        busy={live?.busy}
        onConfirm={confirmLive}
        onCancel={() => setLive(null)}
      >
        {live?.on ? (
          <>
            <p>Real customers will only get AI answers from paid models with a passing test for prompt {data?.promptVersion}:</p>
            <ol className={styles.dialogList}>
              {liveModels.map((m) => (
                <li key={m.id}>{m.displayName}</li>
              ))}
            </ol>
            <p className={styles.muted}>While it is on, free and untested models can't be switched on.</p>
          </>
        ) : (
          <p>Free and untested models can then be switched on and may answer customers. Only do this for development or a demo.</p>
        )}
        {live?.error && (
          <Callout tone="bad" icon={XCircle}>
            {live.error}
            {live.blockers?.length > 0 && (
              <ul>
                {live.blockers.map((b) => (
                  <li key={b.id}>
                    {b.displayName}: {b.reason}
                  </li>
                ))}
              </ul>
            )}
          </Callout>
        )}
      </ConfirmDialog>
    </main>
  );
}
