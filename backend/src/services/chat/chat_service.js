// The chat window's conversations: who owns them, what each message gets as
// an answer, and what is stored. Layer 1 (fixed answers and the guided Find a
// car flow) answers first. A typed message Layer 1 can't answer goes to the
// AI (Layer 2); when no AI model is switched on, or every model fails, it
// gets a fallback offering the quick actions and the guided flow.
//
// Layer 3 (Step 9): the customer can ask for a person. A short button flow
// (chat_handoff_service) raises a support ticket once they press Send; while
// the ticket is open, what they type goes to the operator or platform
// support instead of the assistant, and staff replies appear in the chat.
//
// Ownership: a signed-in customer's conversation is theirs by customer id. A
// visitor's is theirs by a random token the window keeps for the session.
// Nobody can open a conversation by guessing its number.

import crypto from "node:crypto";
import prisma from "../../config/db.js";
import { trackEvent } from "../analytics_service.js";
import { parseCarSearchQuery } from "../car_search_service.js";
import { getPublicCar, searchPublicCars } from "../public_car_service.js";
import { searchInputFrom, searchView, withoutChip } from "../ai/tools/tool_results.js";
import { aiReplyPayload } from "./chat_ai_view.js";
import { AiUnavailableError, answerWithAi, attemptsSummary } from "../ai/ai_service.js";
import { HISTORY_MESSAGES } from "../ai/ai_config.js";
import { countIpMessage, limitReached, loadAiSettings, monthSpend, noteSpend, overallCapReached } from "../ai/ai_limits.js";
import { toAiHistory } from "../ai/chat_history.js";
import { advanceGuided, choiceLabel, startGuided } from "./chat_guided_service.js";
import { FIND_CAR_ACTION, matchMessage, quickActions, ruleAnswer, welcomeMessage } from "./chat_rules_service.js";
import { HANDOFF_ACTION, advanceHandoff, emergencyReply, handoffFromAi, startHandoff, typedIntoHandoff } from "./chat_handoff_service.js";
import { activeTicket, customerResolve, noteCustomerMessage, ticketBanner } from "../support/support_ticket_service.js";
import { isEmergencyMessage, isHandoffMessage } from "../support/support_rules.js";

const HISTORY_LIMIT = 60;

function httpError(statusCode, message, appCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  return err;
}

async function maxMessageChars() {
  return (await loadAiSettings()).maxMessageChars;
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function sameToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function owns(conversation, { customer, visitorToken }) {
  if (conversation.customerId) return Boolean(customer && customer.id === conversation.customerId);
  return sameToken(conversation.visitorToken, visitorToken);
}

/**
 * The caller's conversation, or a new one. A visitor who signs in mid-chat
 * keeps the conversation: it is claimed for their account.
 */
async function resolveConversation({ conversationId, visitorToken, customer }) {
  if (conversationId) {
    const existing = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
    if (existing && existing.status !== "CLOSED" && owns(existing, { customer, visitorToken })) {
      if (!existing.customerId && customer) {
        return prisma.chatConversation.update({ where: { id: existing.id }, data: { customerId: customer.id } });
      }
      return existing;
    }
  }
  return prisma.chatConversation.create({
    data: customer ? { customerId: customer.id } : { visitorToken: newToken() },
  });
}

async function loadListing(listingId) {
  if (!listingId) return null;
  try {
    return await getPublicCar(listingId);
  } catch {
    return null; // Not public any more: answer as if no car were on screen.
  }
}

function assistantView(row) {
  return { id: row.id, role: "assistant", createdAt: row.createdAt, feedback: row.feedback, ...(row.payload || { kind: "text", text: row.content }) };
}

function userView(row) {
  return { id: row.id, role: "user", text: row.content, createdAt: row.createdAt };
}

// A reply typed by the operator or platform support on their page.
function staffView(row) {
  return { id: row.id, role: "staff", from: row.payload?.from || "Support", text: row.content, createdAt: row.createdAt };
}

function messageView(row) {
  if (row.senderRole === "ASSISTANT") return assistantView(row);
  if (row.senderRole === "OPERATOR" || row.senderRole === "ADMIN") return staffView(row);
  return userView(row);
}

const FALLBACK_TEXT = {
  down: "I can't answer that in my own words right now. Pick a topic below, or find a car step by step.",
  unmatched: "I couldn't match that to one of my topics yet. Pick one below, or find a car step by step.",
  // The answer check refused the AI's answer twice (Step 8).
  unchecked: "I couldn't confirm every detail of that from the platform's live data, so I won't guess. Pick a topic below, or find a car step by step.",
  // Step 10: the customer's hourly limit. The monthly cap uses "down".
  limit: "You've asked me a lot in the last hour, so I can't answer in my own words for a little while. You can still pick a topic below, find a car step by step, or talk to a person.",
};

// Every fallback also offers a person (design: hand-off after the AI fails
// twice on the same question).
async function fallbackReply({ signedIn, reason = "unmatched" }) {
  return {
    kind: "text",
    text: FALLBACK_TEXT[reason],
    actions: [...(await quickActions({ signedIn })), HANDOFF_ACTION],
    fallback: true,
  };
}

function withError(errorType, extra) {
  return errorType ? `${errorType},${extra}` : extra;
}

/**
 * Layer 2: the AI answers a typed message Layer 1 couldn't, and the answer
 * check (Step 8) decides whether it is shown.
 * Returns { reply, ai, lastSearch } with what to log, or { reply: null, ai,
 * reason } when nothing can be shown: "down" (no model answered),
 * "unchecked" (the answer failed the check twice) or "unmatched" (no model
 * is switched on at all).
 */
async function aiReply({ text, conversation, customer, listingLoader }) {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HISTORY_MESSAGES,
    select: { senderRole: true, content: true },
  });
  const history = toAiHistory([...rows.reverse(), { senderRole: customer ? "CUSTOMER" : "VISITOR", content: text }]);
  const listing = await listingLoader();
  const carInView = listing ? { id: listing.id, name: `${listing.vehicleMake} ${listing.vehicleModel}`.trim() } : null;

  const stored = conversation.searchCriteria?.lastSearch;
  const lastSearch = stored ? searchInputFrom(stored) : null;

  try {
    // The customer comes from the session only; the tools never take one from the AI.
    const answer = await answerWithAi({ history, customerId: customer?.id ?? null, carInView, lastSearch });
    const ai = {
      aiModelId: answer.model.id,
      modelUsed: answer.model.modelName,
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
      estimatedCostUsd: answer.costUsd,
      responseMs: answer.responseMs,
      errorType: attemptsSummary(answer.attempts),
      toolsCalled: answer.toolsCalled.length ? answer.toolsCalled : undefined,
      checkFailed: answer.checkFailed,
    };
    if (answer.checkFailed) {
      // What was unsupported goes in the log, for the Health panel and tuning.
      const note = answer.shown ? `check_retry:${answer.firstUnsupported.join("|")}` : `check_failed:${answer.unsupported.join("|")}`;
      ai.errorType = withError(ai.errorType, note).slice(0, 500);
    }
    if (!answer.shown) return { reply: null, ai, reason: "unchecked" };
    // An empty answer (e.g. cut off at the length limit) is not shown.
    if (!answer.text) return { reply: null, ai: { ...ai, errorType: withError(ai.errorType, "empty") }, reason: "down" };
    const { payload, lastSearch: searched } = aiReplyPayload(answer.text, answer.toolResults);
    // The AI offered a person: the chat shows the Send button (Step 9).
    const offer = [...(answer.toolResults || [])].reverse().find((r) => r.name === "hand_off" && !r.isError && r.view?.handoff);
    return { reply: payload, ai, lastSearch: searched, handoffDraft: offer?.view.handoff || null };
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) throw err;
    if (err.reason === "no_models") return { reply: null, ai: null, reason: "unmatched" };
    return {
      reply: null,
      ai: { errorType: attemptsSummary(err.attempts) || err.reason, responseMs: err.attempts.reduce((sum, a) => sum + a.ms, 0) || null },
      reason: "down",
    };
  }
}

/**
 * Whether a typed message may go to the AI (Step 10). Returns null, or
 * { reason, errorType } for the fallback: the overall monthly cap ("down",
 * logged as cap:monthly) or the customer's hourly limit ("limit", logged as
 * limit:customer or limit:ip, which the AI models page counts).
 */
async function aiHeldBack({ customer, ip }) {
  const settings = await loadAiSettings();
  if (overallCapReached(settings, await monthSpend())) return { reason: "down", errorType: "cap:monthly" };
  const limit = await limitReached({ customer, ip, settings });
  if (limit) return { reason: "limit", errorType: `limit:${limit.limit}` };
  return null;
}

/** After a message went to the AI: count it for the visitor, and add its cost. */
function afterAiAttempt({ ai, customer, ip }) {
  if (!ai?.responseMs) return; // no model was called
  if (!customer) countIpMessage(ip);
  noteSpend(ai.aiModelId, ai.estimatedCostUsd);
}

/**
 * A chip on a search's cards was tapped: rerun the search without that
 * filter, with no AI call (chatbot design, "How search results appear").
 */
async function chipReply(lastSearch, chipKey) {
  if (!lastSearch) return null;
  const query = withoutChip(lastSearch, chipKey);
  const found = await searchPublicCars(parseCarSearchQuery(query));
  trackEvent({
    name: "search_performed",
    properties: { input_mode: "conversational", filters_applied: Object.keys(query), result_count: found.total, category: "CAR_RENTAL" },
  });
  const view = searchView(found, query);
  const text = found.total
    ? `Here ${found.total === 1 ? "is 1 car" : `are ${found.total} cars`} without that filter.`
    : "Still nothing matches. Remove another filter below, or find a car step by step.";
  return {
    reply: { kind: "cars", text, intro: text, cars: view.cars, chips: view.chips, chipsEditable: true, total: view.total, resultsHref: view.resultsHref },
    criteria: query,
  };
}

/**
 * Works out the answer to one message or button.
 * Returns { userText, reply, guided?, criteria?, fallback, ai? }, where ai
 * holds the AI fields to store on the answer (model, tokens, cost, errors).
 */
async function answer({ text, action, conversation, customer, listingLoader, ip }) {
  const signedIn = Boolean(customer);
  const stored = conversation.searchCriteria || {};

  if (action?.type === "handoff") {
    const result = await advanceHandoff({ value: action.value, stored: stored.handoff, conversation, customer, ip });
    const reply = result.showTopics ? { ...result.reply, actions: await quickActions({ signedIn }) } : result.reply;
    return { userText: result.userText, reply, handoff: result.state, ticket: result.ticket || null };
  }

  if (action?.type === "welcome") {
    return { userText: null, reply: await welcomeMessage({ signedIn }) };
  }

  if (action?.type === "quick") {
    if (action.key === FIND_CAR_ACTION.key) {
      const { state, reply } = startGuided();
      return { userText: FIND_CAR_ACTION.label, reply, guided: state };
    }
    const actions = await quickActions({ signedIn: true });
    const label = actions.find((a) => a.key === action.key)?.label;
    const reply = label ? await ruleAnswer(action.key, { listing: await listingLoader(), customerId: customer?.id }) : null;
    if (!reply) return { userText: label || null, reply: await fallbackReply({ signedIn }), fallback: true };
    return { userText: label, reply };
  }

  if (action?.type === "chip") {
    const label = (stored.lastSearchChips || []).find((c) => c.key === action.key)?.label;
    const result = await chipReply(stored.lastSearch, action.key);
    if (!result) return { userText: null, reply: await fallbackReply({ signedIn }), fallback: true };
    return { userText: label ? `Remove: ${label}` : "Remove a filter", reply: result.reply, criteria: result.criteria };
  }

  if (action?.type === "guided") {
    const step = stored.guided?.step;
    const label = choiceLabel(step, action.value);
    const result = await advanceGuided(stored.guided, action.value);
    if (result.error) {
      const restart = startGuided();
      return {
        userText: label,
        reply: { ...restart.reply, text: `${result.error} ${restart.reply.text}` },
        guided: restart.state,
      };
    }
    return { userText: label, reply: result.reply, guided: result.state, criteria: result.criteria };
  }

  // A typed message.
  const maxChars = await maxMessageChars();
  if (text.length > maxChars) {
    return {
      userText: text.slice(0, maxChars),
      reply: { kind: "text", text: `That message is a bit long. Please keep it under ${maxChars} characters.` },
    };
  }

  // The hand-off flow is waiting for the details or an email address.
  const typed = typedIntoHandoff({ text, stored: stored.handoff, customer });
  if (typed) return { userText: text, reply: typed.reply, handoff: typed.state };

  // Layer 1 wording for Layer 3: emergencies and asking for a person.
  if (isEmergencyMessage(text)) return { userText: text, reply: await emergencyReply(customer?.id), handoff: null };
  if (isHandoffMessage(text)) {
    const { state, reply } = startHandoff({ signedIn });
    return { userText: text, reply, handoff: { ...state, reason: "customer_request" } };
  }

  const key = await matchMessage(text);
  if (key) {
    const reply = await ruleAnswer(key, { listing: await listingLoader(), customerId: customer?.id });
    if (reply) return { userText: text, reply };
  }
  // Step 10: the monthly cap and the customer's hourly limit. Layer 1 above
  // still answers; only the AI call is held back.
  const held = await aiHeldBack({ customer, ip });
  if (held) {
    return { userText: text, reply: await fallbackReply({ signedIn, reason: held.reason }), fallback: true, ai: { errorType: held.errorType } };
  }

  const ai = await aiReply({ text, conversation, customer, listingLoader });
  afterAiAttempt({ ai: ai.ai, customer, ip });
  if (ai.reply && ai.handoffDraft) {
    // The AI's words, then the flow's next step (usually the Send button).
    const flow = await handoffFromAi({ draft: ai.handoffDraft, customer });
    const reply = flow.reply.kind === "options" ? { ...flow.reply, intro: ai.reply.text } : { ...flow.reply, text: `${ai.reply.text} ${flow.reply.text}` };
    return { userText: text, reply, ai: ai.ai, handoff: flow.state };
  }
  if (ai.reply) return { userText: text, reply: ai.reply, ai: ai.ai, ...(ai.lastSearch ? { criteria: ai.lastSearch } : {}) };
  // A refused answer starts the flow's reason as check_failed if the customer takes the offer.
  const handoff = ai.reason === "unchecked" ? { step: "offered", reason: "check_failed" } : undefined;
  return { userText: text, reply: await fallbackReply({ signedIn, reason: ai.reason }), fallback: true, ai: ai.ai, ...(handoff ? { handoff } : {}) };
}

/**
 * Handles one message or button press from the chat window.
 * body: { conversationId?, visitorToken?, listingId?, text?, action? }
 * customer: { id, name } from the session, or null.
 */
export async function handleChatMessage(body, customer = null, { ip = null } = {}) {
  const conversation = await resolveConversation({
    conversationId: body.conversationId,
    visitorToken: body.visitorToken,
    customer,
  });

  const ticket = conversation.status === "ESCALATED" ? await activeTicket(conversation.id) : null;
  const typedText = (body.text || "").trim();

  // While a ticket is open, typed messages go to the person handling it.
  if (ticket && !body.action && typedText) return messageToTicket({ conversation, customer, ticket, text: typedText });

  // "Back to the assistant": the customer says they're done with the ticket.
  if (ticket && body.action?.type === "handoff" && body.action.value === "close") {
    await customerResolve(ticket);
    return saveExchange({
      conversation,
      customer,
      userText: "Back to the assistant",
      reply: { kind: "text", text: `Request ${ticket.reference} is closed. How else can I help?`, actions: await quickActions({ signedIn: Boolean(customer) }) },
      criteria: conversation.searchCriteria || {},
      listingInViewId: conversation.listingInViewId,
      ticket: null,
    });
  }

  // The car on screen: a new one from the page replaces the stored one;
  // null means the customer left the car page.
  let listingInViewId = conversation.listingInViewId;
  if (body.listingId !== undefined) listingInViewId = body.listingId || null;
  let listingPromise = null;
  const listingLoader = () => {
    listingPromise ||= loadListing(listingInViewId);
    return listingPromise;
  };

  const text = (body.text || "").trim();
  if (!body.action && !text) throw httpError(400, "Type a message or pick an option.", "CHAT_EMPTY");

  const result = await answer({ text, action: body.action, conversation, customer, listingLoader, ip });

  const criteria = { ...(conversation.searchCriteria || {}) };
  if (result.guided) criteria.guided = result.guided;
  if (result.handoff !== undefined) {
    if (result.handoff) criteria.handoff = result.handoff;
    else delete criteria.handoff;
  } else if (text && !body.action) {
    delete criteria.handoff; // a typed question leaves an unfinished hand-off
  }
  if (result.criteria) {
    criteria.lastSearch = result.criteria;
    // The chips the customer can tap next, so a tap can be labelled.
    if (result.reply.chipsEditable) criteria.lastSearchChips = result.reply.chips;
    else delete criteria.lastSearchChips;
  }

  const currentTicket = result.ticket || ticket;
  return saveExchange({ conversation, customer, userText: result.userText, reply: result.reply, result, criteria, listingInViewId, ticket: currentTicket });
}

/**
 * Stores the customer's message (if any) and the assistant's reply, and
 * returns what the window shows.
 */
async function saveExchange({ conversation, customer, userText, reply, result = {}, criteria, listingInViewId, ticket }) {
  // Explicit times keep the customer's message before the answer, whatever
  // order the database stamps them in.
  const now = Date.now();
  const writes = [
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { listingInViewId, searchCriteria: criteria, lastMessageAt: new Date(now + 1) },
    }),
  ];
  if (userText) {
    writes.push(
      prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderRole: customer ? "CUSTOMER" : "VISITOR",
          senderId: customer?.id ?? null,
          content: userText,
          isRead: true,
          createdAt: new Date(now),
        },
      })
    );
  }
  writes.push(
    prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderRole: "ASSISTANT",
        content: reply.text,
        layer: result.ai && !result.fallback ? "AI" : "RULE",
        fallbackUsed: Boolean(result.fallback),
        ...(result.ai || {}),
        payload: reply,
        isRead: true,
        createdAt: new Date(now + 1),
      },
    })
  );
  const done = await prisma.$transaction(writes);
  const saved = done[done.length - 1];

  return {
    conversationId: conversation.id,
    visitorToken: conversation.visitorToken || null,
    reply: assistantView(saved),
    ticket: ticketBanner(ticket),
  };
}

/** A typed message while a ticket is open: stored, and passed to staff. No assistant answer. */
async function messageToTicket({ conversation, customer, ticket, text }) {
  const maxChars = await maxMessageChars();
  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderRole: customer ? "CUSTOMER" : "VISITOR",
        senderId: customer?.id ?? null,
        content: text.slice(0, maxChars),
        isRead: true,
        createdAt: now,
      },
    }),
    prisma.chatConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);
  const updated = await noteCustomerMessage(ticket, message.id);
  return {
    conversationId: conversation.id,
    visitorToken: conversation.visitorToken || null,
    reply: null,
    sent: userView(message),
    ticket: ticketBanner(updated),
  };
}

/** The last messages of the caller's conversation, oldest first. */
export async function getConversation({ conversationId, visitorToken, customer }) {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || !owns(conversation, { customer, visitorToken })) {
    throw httpError(404, "Conversation not found", "CHAT_NOT_FOUND");
  }
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HISTORY_LIMIT,
  });
  return {
    conversationId: conversation.id,
    messages: rows.reverse().map(messageView),
    ticket: conversation.status === "ESCALATED" ? ticketBanner(await activeTicket(conversation.id)) : null,
  };
}

/** Thumbs up or down on one of the assistant's answers. */
export async function rateMessage({ conversationId, messageId, visitorToken, customer, feedback }) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });
  if (!message || message.conversationId !== conversationId || message.senderRole !== "ASSISTANT" || !owns(message.conversation, { customer, visitorToken })) {
    throw httpError(404, "Message not found", "CHAT_NOT_FOUND");
  }
  await prisma.chatMessage.update({ where: { id: message.id }, data: { feedback } });
  return { id: message.id, feedback };
}
