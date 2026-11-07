import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Expand, House, MessageCircleMore, Search } from "lucide-react";
import PolicyBody from "../common/PolicyBody";
import useSessionUser from "../../hooks/useSessionUser";
import { useStickyBottomOffset } from "../../utils/stickyBottom";
import { getPublicPolicy } from "../../services/policy_service";
import ChatConversation from "./ChatConversation";
import { closePanel, openChat, openPanel, showView, syncUser, useChat } from "./chatStore";
import styles from "../../assets/styles/public/Chat.module.css";

// The help messenger: a round button in the bottom-right corner that opens a
// panel with Home, the conversation and Help. Mounted by the public and
// customer layouts; hidden where it would get in the way of paying or
// booking, and on /assistant, which is the same chat as a full page.

const HIDDEN = [
  /^\/assistant\/?$/,
  /^\/cars\/[^/]+\/book\/?$/,
  /^\/customer\/checkout\//,
  /^\/customer\/payment-status\//,
  /^\/customer\/upload-receipt\//,
];

const PHONE = "(max-width: 640px)";

const HOME_TOPICS = [
  { key: "find-car", label: "Find a car" },
  { key: "deposit", label: "Deposits" },
  { key: "refunds", label: "Refunds" },
  { key: "late-return", label: "Returning late" },
];

const POLICY_PAGES = [
  { key: "refund-rules", title: "Refund rules" },
  { key: "terms", title: "Terms of service" },
  { key: "privacy", title: "Privacy and personal data" },
];

// Help articles from the policy library, loaded once per visit.
let helpCache = null;
function loadHelp() {
  helpCache ||= getPublicPolicy("help")
    .then(({ data }) => data.sections || [])
    .catch(() => {
      helpCache = null;
      return [];
    });
  return helpCache;
}

function useHelpArticles(enabled) {
  const [articles, setArticles] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadHelp().then((list) => alive && setArticles(list));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return articles;
}

function matches(article, query) {
  const q = query.trim().toLowerCase();
  return !q || article.title.toLowerCase().includes(q) || article.body.toLowerCase().includes(q);
}

function HelpSearch({ value, onChange }) {
  const id = useId();
  return (
    <div className={styles.search}>
      <label htmlFor={id} className={styles.srOnly}>
        Search help
      </label>
      <input id={id} type="search" placeholder="Search help" value={value} onChange={(e) => onChange(e.target.value)} />
      <Search size={17} aria-hidden="true" />
    </div>
  );
}

function ArticleList({ articles }) {
  return (
    <ul className={styles.rowList}>
      {articles.map((a) => (
        <li key={a.key}>
          <button type="button" className={styles.row} onClick={() => showView("help", a.key)}>
            <span>{a.title}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function HomeView({ user, articles }) {
  const [query, setQuery] = useState("");
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const shown = articles.filter((a) => matches(a, query)).slice(0, query ? 6 : 4);
  return (
    <div className={styles.scroll}>
      <div className={styles.hero}>
        <p className={styles.heroTitle}>{firstName ? `Hi ${firstName}, how can we help?` : "Hi, how can we help?"}</p>
      </div>
      <div className={styles.homeCards}>
        <button type="button" className={styles.askCard} onClick={() => openChat()}>
          <span>
            <span className={styles.cardTitle}>Ask the assistant</span>
            <span className={styles.cardText}>Instant answers on cars, deposits and rules</span>
          </span>
          <span className={styles.askArrow}>
            <ArrowRight size={18} aria-hidden="true" />
          </span>
        </button>

        {user && (
          <button
            type="button"
            className={styles.infoCard}
            onClick={() => openChat({ action: { type: "quick", key: "booking-status" }, label: "My booking status" })}
          >
            <span className={styles.infoIcon}>
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <span className={styles.infoText}>
              <span className={styles.cardTitle}>Check my bookings</span>
              <span className={styles.cardText}>Status, payments due and licence checks</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}

        <div className={styles.topicRow}>
          {HOME_TOPICS.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={i === 0 ? styles.chipStrong : styles.chip}
              onClick={() => openChat({ action: { type: "quick", key: t.key }, label: t.label })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.helpBox}>
          <HelpSearch value={query} onChange={setQuery} />
          {shown.length ? <ArticleList articles={shown} /> : <p className={styles.empty}>{query ? "No help article matches. Try asking the assistant." : "Loading help…"}</p>}
        </div>
      </div>
    </div>
  );
}

function HelpView({ articles, articleKey, onNavigate }) {
  const [query, setQuery] = useState("");
  const article = articleKey ? articles.find((a) => a.key === articleKey) : null;

  if (article) {
    return (
      <div className={styles.scroll}>
        <div className={styles.article}>
          <button type="button" className={styles.backLink} onClick={() => showView("help")}>
            <ChevronLeft size={16} aria-hidden="true" /> All help
          </button>
          <h2 className={styles.articleTitle}>{article.title}</h2>
          <div className={styles.articleBody}>
            <PolicyBody body={article.body} />
          </div>
          <button type="button" className={styles.askInline} onClick={() => openChat()}>
            Still stuck? <strong>Ask the assistant</strong>
          </button>
        </div>
      </div>
    );
  }

  const shown = articles.filter((a) => matches(a, query));
  return (
    <div className={styles.scroll}>
      <div className={styles.helpPage}>
        <HelpSearch value={query} onChange={setQuery} />
        <h2 className={styles.groupTitle}>Help articles</h2>
        {shown.length ? <ArticleList articles={shown} /> : <p className={styles.empty}>{articles.length ? "No help article matches." : "Loading help…"}</p>}
        {!query && (
          <>
            <h2 className={styles.groupTitle}>Policies</h2>
            {/* Full legal pages: they open in the main window, so they point
                out instead of in like the help articles above. */}
            <ul className={styles.rowList}>
              {POLICY_PAGES.map((p) => (
                <li key={p.key}>
                  <Link to={`/info/${p.key}`} className={`${styles.row} ${styles.rowExternal}`} onClick={onNavigate}>
                    <span className={styles.rowText}>
                      <span>{p.title}</span>
                      <span className={styles.rowHint}>Opens the full page</span>
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className={styles.askInline} onClick={() => openChat()}>
          Can't find it? <strong>Ask the assistant</strong>
        </button>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const chat = useChat();
  const user = useSessionUser();
  const offset = useStickyBottomOffset();
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const panelId = useId();
  const hidden = HIDDEN.some((re) => re.test(pathname));
  const articles = useHelpArticles(chat.open && !hidden && chat.view !== "chat");
  const userId = user?.id ?? null;

  useEffect(() => {
    syncUser(userId);
  }, [userId]);

  // Escape closes the panel and returns focus to the button.
  useEffect(() => {
    if (!chat.open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        closePanel();
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open]);

  // On a phone the panel fills the screen, so the page behind must not scroll.
  useEffect(() => {
    if (!chat.open || hidden || !window.matchMedia?.(PHONE).matches) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [chat.open, hidden]);

  const onNavigate = useMemo(
    () => () => {
      if (window.matchMedia?.(PHONE).matches) closePanel();
    },
    []
  );

  if (hidden) return null;

  const tabs = [
    { view: "home", label: "Home", Icon: House },
    { view: "help", label: "Help", Icon: CircleHelp },
  ];

  return (
    <div className={styles.widget} style={{ "--chat-offset": `${offset}px` }}>
      {chat.open && (
        <section
          id={panelId}
          ref={panelRef}
          className={`${styles.panel} ${chat.view === "chat" ? styles.panelWide : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label={chat.view === "chat" ? "Assistant" : "Help"}
        >
          {chat.view === "chat" ? (
            <>
              <header className={styles.chatHeader}>
                <button type="button" className={styles.iconButton} aria-label="Back to Home" onClick={() => showView("home")}>
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className={styles.avatar} aria-hidden="true">
                  <MessageCircleMore size={18} />
                </span>
                <span className={styles.chatTitle}>
                  <strong>Assistant</strong>
                  <span>Instant answers on cars and rules</span>
                </span>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.desktopOnly}`}
                  aria-label="Open as a full page"
                  onClick={() => {
                    closePanel();
                    navigate("/assistant");
                  }}
                >
                  <Expand size={17} aria-hidden="true" />
                </button>
                <button type="button" className={`${styles.iconButton} ${styles.phoneOnly}`} aria-label="Close help" onClick={closePanel}>
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
              </header>
              <ChatConversation onNavigate={onNavigate} autoFocus />
            </>
          ) : (
            <>
              <header className={chat.view === "home" ? styles.brandHeader : styles.plainHeader}>
                <span className={styles.brandName}>{chat.view === "home" ? "Help" : "Help articles"}</span>
                <button type="button" className={`${styles.iconButton} ${styles.phoneOnly}`} aria-label="Close help" onClick={closePanel}>
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
              </header>
              {chat.view === "home" ? (
                <HomeView user={user?.role === "CUSTOMER" ? user : null} articles={articles} />
              ) : (
                <HelpView articles={articles} articleKey={chat.article} onNavigate={onNavigate} />
              )}
              <nav className={styles.tabs} aria-label="Help sections">
                {tabs.map(({ view, label, Icon }) => (
                  <button
                    key={view}
                    type="button"
                    className={styles.tab}
                    aria-current={chat.view === view ? "page" : undefined}
                    onClick={() => showView(view)}
                  >
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className={styles.launcher}
        aria-expanded={chat.open}
        aria-controls={chat.open ? panelId : undefined}
        aria-label={chat.open ? "Close help" : "Open help"}
        onClick={() => (chat.open ? closePanel() : openPanel(chat.messages.length > 1 ? "chat" : "home"))}
      >
        {chat.open ? <ChevronDown size={24} aria-hidden="true" /> : <MessageCircleMore size={26} aria-hidden="true" />}
        {!chat.open && <span className={styles.launcherLabel}>Questions? Ask us</span>}
      </button>
    </div>
  );
}
