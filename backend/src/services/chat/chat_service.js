// The chat window's conversations: who owns them, what each message gets as
// an answer, and what is stored. Layer 1 (fixed answers and the guided Find a
// car flow) answers first. A typed message Layer 1 can't answer goes to the
// AI (Layer 2); when no AI model is switched on, or every model fails, it
// gets a fallback offering the quick actions and the guided flow.
//
// Ownership: a signed-in customer's conversation is theirs by customer id. A
// visitor's is theirs by a random token the window keeps for the session.
// Nobody can open a conversation by guessing its number.

import crypto from "node:crypto";
import prisma from "../../config/db.js";
import { getPublicCar } from "../public_car_service.js";
import { AiUnavailableError, answerWithAi, attemptsSummary } from "../ai/ai_service.js";
import { HISTORY_MESSAGES } from "../ai/ai_config.js";
import { toAiHistory } from "../ai/chat_history.js";
import { advanceGuided, choiceLabel, startGuided } from "./chat_guided_service.js";
import { FIND_CAR_ACTION, matchMessage, quickActions, ruleAnswer, welcomeMessage } from "./chat_rules_service.js";

const SETTINGS_MS = 60 * 1000;
const HISTORY_LIMIT = 60;
const DEFAULT_MAX_CHARS = 500;

let settingsCache = null;

function httpError(statusCode, message, appCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  return err;
}

async function maxMessageChars() {
  if (!settingsCache || Date.now() - settingsCache.at > SETTINGS_MS) {
    const row = await prisma.aiSettings.findUnique({ where: { id: 1 }, select: { maxMessageChars: true } }).catch(() => null);
    settingsCache = { at: Date.now(), maxChars: row?.maxMessageChars || DEFAULT_MAX_CHARS };
  }
  return settingsCache.maxChars;
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

async function fallbackReply({ signedIn, aiDown = false }) {
  return {
    kind: "text",
    text: aiDown
      ? "I can't answer that in my own words right now. Pick a topic below, or find a car step by step."
      : "I couldn't match that to one of my topics yet. Pick one below, or find a car step by step.",
    actions: await quickActions({ signedIn }),
    fallback: true,
  };
}

/**
 * Layer 2: the AI answers a typed message Layer 1 couldn't.
 * Returns { reply, ai } with what to log, or { reply: null, ai, down } when
 * no model answered (down is false when no model is switched on at all).
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

  try {
    // The customer comes from the session only; the tools never take one from the AI.
    const answer = await answerWithAi({ history, customerId: customer?.id ?? null, carInView });
    const ai = {
      aiModelId: answer.model.id,
      modelUsed: answer.model.modelName,
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
      estimatedCostUsd: answer.costUsd,
      responseMs: answer.responseMs,
      errorType: attemptsSummary(answer.attempts),
      toolsCalled: answer.toolsCalled.length ? answer.toolsCalled : undefined,
    };
    // An empty answer (e.g. cut off at the length limit) is not shown.
    if (!answer.text) return { reply: null, ai: { ...ai, errorType: ai.errorType ? `${ai.errorType},empty` : "empty" }, down: true };
    return { reply: { kind: "text", text: answer.text }, ai };
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) throw err;
    if (err.reason === "no_models") return { reply: null, ai: null, down: false };
    return {
      reply: null,
      ai: { errorType: attemptsSummary(err.attempts) || err.reason, responseMs: err.attempts.reduce((sum, a) => sum + a.ms, 0) || null },
      down: true,
    };
  }
}

/**
 * Works out the answer to one message or button.
 * Returns { userText, reply, guided?, criteria?, fallback, ai? }, where ai
 * holds the AI fields to store on the answer (model, tokens, cost, errors).
 */
async function answer({ text, action, conversation, customer, listingLoader }) {
  const signedIn = Boolean(customer);
  const stored = conversation.searchCriteria || {};

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
  const key = await matchMessage(text);
  if (key) {
    const reply = await ruleAnswer(key, { listing: await listingLoader(), customerId: customer?.id });
    if (reply) return { userText: text, reply };
  }
  const ai = await aiReply({ text, conversation, customer, listingLoader });
  if (ai.reply) return { userText: text, reply: ai.reply, ai: ai.ai };
  return { userText: text, reply: await fallbackReply({ signedIn, aiDown: ai.down }), fallback: true, ai: ai.ai };
}

/**
 * Handles one message or button press from the chat window.
 * body: { conversationId?, visitorToken?, listingId?, text?, action? }
 * customer: { id, name } from the session, or null.
 */
export async function handleChatMessage(body, customer = null) {
  const conversation = await resolveConversation({
    conversationId: body.conversationId,
    visitorToken: body.visitorToken,
    customer,
  });

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

  const result = await answer({ text, action: body.action, conversation, customer, listingLoader });

  const criteria = { ...(conversation.searchCriteria || {}) };
  if (result.guided) criteria.guided = result.guided;
  if (result.criteria) criteria.lastSearch = result.criteria;

  // Explicit times keep the customer's message before the answer, whatever
  // order the database stamps them in.
  const now = Date.now();
  const writes = [
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { listingInViewId, searchCriteria: criteria, lastMessageAt: new Date(now + 1) },
    }),
  ];
  if (result.userText) {
    writes.push(
      prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderRole: customer ? "CUSTOMER" : "VISITOR",
          senderId: customer?.id ?? null,
          content: result.userText,
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
        content: result.reply.text,
        layer: result.ai && !result.fallback ? "AI" : "RULE",
        fallbackUsed: Boolean(result.fallback),
        ...(result.ai || {}),
        payload: result.reply,
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
    messages: rows.reverse().map((row) => (row.senderRole === "ASSISTANT" ? assistantView(row) : userView(row))),
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
