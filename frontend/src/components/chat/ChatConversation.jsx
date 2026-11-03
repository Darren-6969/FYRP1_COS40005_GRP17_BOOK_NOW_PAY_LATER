import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUp, Check, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { sendAction, sendFeedback, sendText, setPageListing, startConversation, useChat } from "./chatStore";
import DatePicker from "../common/DatePicker";
import styles from "../../assets/styles/public/Chat.module.css";

// The conversation itself: messages, the guided-flow buttons, car and booking
// cards, and the message box. Used by the floating panel and /assistant.

function formatRm(sen) {
  if (sen === null || sen === undefined) return "";
  const rm = sen / 100;
  return `RM ${rm.toLocaleString("en-MY", { minimumFractionDigits: Number.isInteger(rm) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function klToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function ChatLink({ href, children, className, onNavigate }) {
  return (
    <Link to={href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

function Actions({ actions, disabled }) {
  if (!actions?.length) return null;
  return (
    <div className={styles.actions}>
      {actions.map((a) => (
        <button key={a.key} type="button" className={styles.chip} disabled={disabled} onClick={() => sendAction({ type: "quick", key: a.key }, a.label)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

function CustomDates({ disabled }) {
  const id = useId();
  const today = klToday();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const valid = from && to && from >= today && to > from;
  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const label = `${new Date(`${from}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} to ${new Date(`${to}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
    sendAction({ type: "guided", value: `custom:${from}:${to}` }, label);
  };
  return (
    <form className={styles.customDates} onSubmit={submit}>
      <div className={styles.dateField}>
        <label htmlFor={`${id}-from`}>Pickup</label>
        <DatePicker id={`${id}-from`} placeholder="Pick a day" min={today} value={from} onChange={(e) => setFrom(e.target.value)} disabled={disabled} />
      </div>
      <div className={styles.dateField}>
        <label htmlFor={`${id}-to`}>Return</label>
        <DatePicker id={`${id}-to`} placeholder="Pick a day" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} disabled={disabled} />
      </div>
      <button type="submit" className={styles.secondaryButton} disabled={disabled || !valid}>
        Use these dates
      </button>
    </form>
  );
}

function Options({ message, interactive, disabled }) {
  const [picked, setPicked] = useState(null);
  // The choice stays marked only while its answer is on the way.
  const shownPick = disabled ? picked : null;
  return (
    <div className={styles.stepCard} data-answered={interactive ? undefined : ""}>
      <div className={styles.stepHead}>
        <span className={styles.stepQuestion}>{message.text}</span>
        <span className={styles.stepCount}>{message.stepLabel}</span>
      </div>
      {interactive ? (
        <>
          <div className={styles.optionGrid} data-picking={shownPick ? "" : undefined}>
            {message.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={styles.option}
                disabled={disabled}
                aria-pressed={shownPick === o.value}
                onClick={() => {
                  setPicked(o.value);
                  sendAction({ type: "guided", value: o.value }, o.label);
                }}
              >
                <span>{o.label}</span>
                {shownPick === o.value && <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {message.allowCustomDates && <CustomDates disabled={disabled} />}
        </>
      ) : (
        <span className={styles.muted}>Answered</span>
      )}
    </div>
  );
}

function CarCards({ message, onNavigate }) {
  return (
    <div className={styles.cardsBlock}>
      <div className={styles.bubble}>{message.intro || message.text}</div>
      {message.chips?.length > 0 && (
        <ul className={styles.criteria} aria-label="Searched with">
          {message.chips.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <ul className={styles.carList}>
        {message.cars.map((car) => (
          <li key={car.id}>
            <ChatLink href={car.href} className={styles.carCard} onNavigate={onNavigate}>
              <span className={styles.carPhoto}>
                {car.imageUrl ? <img src={car.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{car.name.slice(0, 1)}</span>}
              </span>
              <span className={styles.carBody}>
                <span className={styles.carName}>{car.name}</span>
                <span className={styles.carMeta}>
                  {car.operator} · {car.seats} seats · {car.city}
                </span>
                <span className={styles.carPrice}>
                  {car.totalSen !== null ? (
                    <>
                      <strong>{formatRm(car.totalSen)}</strong> total · {formatRm(car.depositSen)} deposit
                    </>
                  ) : (
                    <>
                      <strong>{formatRm(car.dailySen)}</strong> a day
                    </>
                  )}
                </span>
              </span>
            </ChatLink>
          </li>
        ))}
      </ul>
      {message.resultsHref && (
        <ChatLink href={message.resultsHref} className={styles.resultsLink} onNavigate={onNavigate}>
          {message.total > message.cars.length ? `See all ${message.total} cars` : "Open in the results page"}
          <ArrowRight size={15} aria-hidden="true" />
        </ChatLink>
      )}
    </div>
  );
}

function BookingCards({ message, onNavigate }) {
  return (
    <div className={styles.cardsBlock}>
      {message.intro && <div className={styles.bubble}>{message.intro}</div>}
      {message.bookings.map((b) => (
        <div key={b.code} className={styles.bookingCard}>
          <div className={styles.bookingHead}>
            <span className={styles.carName}>
              {b.code} · {b.car}
            </span>
            <span className={styles.status}>{b.status}</span>
          </div>
          <span className={styles.carMeta}>
            {b.dates}
            {b.operator ? ` · ${b.operator}` : ""}
          </span>
          {b.facts.length > 0 && (
            <ul className={styles.facts}>
              {b.facts.map((f) => (
                <li key={`${f.label}-${f.detail}`} data-tone={f.tone}>
                  <strong>{f.label}</strong>
                  {f.detail}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.bookingActions}>
            {b.actions.map((a) => (
              <ChatLink key={a.href + a.label} href={a.href} className={a.primary ? styles.primaryButton : styles.secondaryButton} onNavigate={onNavigate}>
                {a.label}
              </ChatLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Feedback({ message }) {
  return (
    <div className={styles.feedback}>
      <span className={styles.muted}>Helpful?</span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Helpful"
        aria-pressed={message.feedback === "UP"}
        onClick={() => sendFeedback(message.id, message.feedback === "UP" ? null : "UP")}
      >
        <ThumbsUp size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Not helpful"
        aria-pressed={message.feedback === "DOWN"}
        onClick={() => sendFeedback(message.id, message.feedback === "DOWN" ? null : "DOWN")}
      >
        <ThumbsDown size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function AssistantMessage({ message, latest, sending, onNavigate }) {
  const rateable = typeof message.id === "number" && message.templateKey !== "welcome" && message.kind !== "options";
  return (
    <div className={styles.assistantRow}>
      {message.kind === "options" && <Options message={message} interactive={latest} disabled={sending} />}
      {message.kind === "cars" && <CarCards message={message} onNavigate={onNavigate} />}
      {message.kind === "bookings" && <BookingCards message={message} onNavigate={onNavigate} />}
      {(message.kind === "text" || !message.kind) && <div className={styles.bubble}>{message.text}</div>}
      {message.links?.length > 0 && (
        <div className={styles.links}>
          {message.links.map((l) => (
            <ChatLink key={l.href} href={l.href} className={styles.inlineLink} onNavigate={onNavigate}>
              {l.label}
            </ChatLink>
          ))}
        </div>
      )}
      {latest && <Actions actions={message.actions} disabled={sending} />}
      {rateable && <Feedback message={message} />}
    </div>
  );
}

function Composer({ disabled, autoFocus }) {
  const id = useId();
  const [text, setText] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // Grow with the text up to about four lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim() || disabled) return;
    sendText(text);
    setText("");
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor={id} className={styles.srOnly}>
        Message the assistant
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        value={text}
        maxLength={1000}
        placeholder="Ask about cars, deposits or refunds"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
      />
      <button type="submit" className={styles.send} aria-label="Send" disabled={disabled || !text.trim()}>
        <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </form>
  );
}

// The first screen of a new chat on /assistant: the welcome and its topics as
// a few large suggestions, before anything has been asked.
function Starter({ welcome, sending }) {
  return (
    <div className={styles.starter}>
      <h2 className={styles.starterTitle}>How can I help?</h2>
      {welcome && <p className={styles.starterLead}>{welcome.text}</p>}
      {welcome?.actions?.length > 0 && (
        <div className={styles.starterGrid}>
          {welcome.actions.map((a) => (
            <button key={a.key} type="button" className={styles.starterCard} disabled={sending} onClick={() => sendAction({ type: "quick", key: a.key }, a.label)}>
              <span>{a.label}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Typing({ hint }) {
  return (
    <div className={styles.assistantRow}>
      <div className={styles.typing} role="status" aria-label={hint || "The assistant is answering"}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {hint && <span className={styles.typingHint}>{hint}…</span>}
      </div>
    </div>
  );
}

export default function ChatConversation({ onNavigate, autoFocus = false, starter = false }) {
  const chat = useChat();
  const listRef = useRef(null);
  const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant");
  const onlyWelcome = !chat.messages.length || (chat.messages.length === 1 && chat.messages[0].templateKey === "welcome");
  const showStarter = starter && onlyWelcome && !chat.error;

  useEffect(() => {
    startConversation();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.sending]);

  return (
    <div className={styles.conversation}>
      {chat.listing && (
        <div className={styles.context}>
          <span>Asking about: {chat.listing.name}</span>
          <button type="button" className={styles.contextClear} aria-label="Stop asking about this car" onClick={() => setPageListing(null)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div ref={listRef} className={styles.messages} aria-live="polite" aria-relevant="additions">
        {showStarter ? (
          <Starter welcome={chat.messages[0]} sending={chat.sending} />
        ) : (
          chat.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className={styles.userRow}>
                <div className={styles.userBubble}>{m.text}</div>
              </div>
            ) : (
              <AssistantMessage key={m.id} message={m} latest={m === lastAssistant} sending={chat.sending} onNavigate={onNavigate} />
            )
          )
        )}
        {chat.sending && !showStarter && <Typing hint={chat.sendingHint} />}
        {chat.error && (
          <div className={styles.error} role="alert">
            {chat.error}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Composer disabled={chat.sending} autoFocus={autoFocus} />
        <p className={styles.disclaimer}>The assistant can't book, pay or cancel for you.</p>
      </div>
    </div>
  );
}
