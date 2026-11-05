import { useSyncExternalStore } from "react";
import { postChatMessage, putChatFeedback } from "../../services/chat_service";

// One chat for the whole site: the floating panel and the /assistant page
// read and write the same conversation. It lasts for the browser session
// (sessionStorage), so moving between pages keeps the chat, and signing out
// on a shared computer clears it.

const KEY = "bnpl:chat";
const MAX_KEPT = 60;

const EMPTY = {
  open: false,
  view: "home", // home | help | chat
  article: null, // help article open in the Help tab
  conversationId: null,
  visitorToken: null,
  userId: null,
  messages: [],
  sending: false,
  sendingHint: "", // what the assistant is doing while it answers
  error: "",
  listing: null, // { id, name } of the car on screen
};

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!saved) return EMPTY;
    // A message still pending was sent just before a reload; its request is
    // gone, so it would wait for an answer forever.
    const messages = (saved.messages || []).filter((m) => !m.pending);
    return { ...EMPTY, ...saved, messages, sending: false, sendingHint: "", error: "", listing: null, article: null };
  } catch {
    return EMPTY;
  }
}

let state = typeof window === "undefined" ? EMPTY : load();
const listeners = new Set();

function persist() {
  try {
    const { open, view, conversationId, visitorToken, userId, messages } = state;
    sessionStorage.setItem(KEY, JSON.stringify({ open, view, conversationId, visitorToken, userId, messages: messages.slice(-MAX_KEPT) }));
  } catch {
    // Storage full or blocked: the chat still works for this page.
  }
}

function setState(patch) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChat() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

// ── Panel ───────────────────────────────────────────────────────────

export function openPanel(view = "home") {
  setState({ open: true, view, article: null });
}

export function closePanel() {
  setState({ open: false });
}

export function showView(view, article = null) {
  setState({ view, article });
}

/** The car page reports its car so "this car" means that listing. */
export function setPageListing(listing) {
  if (state.listing?.id === listing?.id) return;
  setState({ listing: listing ? { id: listing.id, name: listing.name } : null });
}

/** A different person signed in or out: drop the old conversation. */
export function syncUser(userId) {
  if (state.userId === userId) return;
  if (state.userId && state.userId !== userId) {
    setState({ ...EMPTY, open: false });
  }
  setState({ userId });
}

export function newChat() {
  setState({ conversationId: null, visitorToken: null, messages: [], error: "", sending: false, sendingHint: "" });
  startConversation();
}

// ── Messages ────────────────────────────────────────────────────────

// Temporary ids for messages awaiting the server. Saved messages keep theirs
// across reloads, so the page-load time keeps a new page's ids distinct.
const tempPrefix = `tmp-${Date.now().toString(36)}`;
let tempId = 0;

const BOOKING_KEYS = ["booking-status", "payments-due", "licence-status"];

// Slow answers say what is happening instead of only showing dots.
function hintFor(action) {
  if (action?.type === "guided") {
    const last = [...state.messages].reverse().find((m) => m.role === "assistant");
    if (last?.step === "budget") return "Searching cars for your dates";
  }
  if (action?.type === "quick" && BOOKING_KEYS.includes(action.key)) return "Checking your bookings";
  return "";
}

function errorText(err) {
  const status = err.response?.status;
  if (status === 429) return err.response?.data?.message || "You're sending messages very quickly. Please wait a moment.";
  if (status === 400) return err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "That message couldn't be sent.";
  return "The assistant couldn't be reached. Check your connection and try again.";
}

async function post(body, userText) {
  if (state.sending) return;
  const optimistic = userText ? [{ id: `${tempPrefix}-${++tempId}`, role: "user", text: userText, pending: true }] : [];
  setState({ messages: [...state.messages, ...optimistic], sending: true, sendingHint: body.text ? "Thinking" : hintFor(body.action), error: "" });
  try {
    const { data } = await postChatMessage({
      ...body,
      conversationId: state.conversationId || undefined,
      visitorToken: state.visitorToken || undefined,
      listingId: state.listing?.id ?? null,
    });
    const restarted = state.conversationId && data.conversationId !== state.conversationId;
    const kept = (restarted ? optimistic : state.messages).map((m) => (m.pending ? { ...m, pending: false } : m));
    setState({
      conversationId: data.conversationId,
      visitorToken: data.visitorToken,
      messages: [...kept, data.reply].slice(-MAX_KEPT),
      sending: false,
      sendingHint: "",
    });
  } catch (err) {
    setState({
      messages: state.messages.filter((m) => !optimistic.includes(m)),
      sending: false,
      sendingHint: "",
      error: errorText(err),
    });
  }
}

/** Shows the welcome message once, when the chat is first opened. */
export function startConversation() {
  if (!state.messages.length && !state.sending) post({ action: { type: "welcome" } }, null);
}

export function sendText(text) {
  const clean = String(text || "").trim();
  if (clean) post({ text: clean }, clean);
}

/** A quick action or guided-flow button; label is shown as the customer's message. */
export function sendAction(action, label) {
  post({ action }, label);
}

export async function sendFeedback(messageId, feedback) {
  if (!state.conversationId) return;
  const previous = state.messages;
  setState({ messages: previous.map((m) => (m.id === messageId ? { ...m, feedback } : m)) });
  try {
    await putChatFeedback(state.conversationId, messageId, { visitorToken: state.visitorToken || null, feedback });
  } catch {
    setState({ messages: previous });
  }
}

/** Open the panel straight into the chat, optionally sending a message. */
export function openChat({ text, action, label } = {}) {
  openPanel("chat");
  if (text) sendText(text);
  else if (action) sendAction(action, label);
  else startConversation();
}
