// Turns stored chat messages into the provider-neutral history the AI gets
// with each new message. Kept free of database access so it can be tested.

import { HISTORY_MESSAGES } from "./ai_config.js";

const USER_ROLES = new Set(["CUSTOMER", "VISITOR"]);

/**
 * rows: chat messages oldest first ({ senderRole, content }).
 * Keeps the last `limit` customer and assistant messages, joins messages that
 * follow each other from the same side, and starts with the customer, as
 * Google requires. The welcome message is dropped that way.
 */
export function toAiHistory(rows, limit = HISTORY_MESSAGES) {
  const turns = [];
  rows
    .filter((r) => (USER_ROLES.has(r.senderRole) || r.senderRole === "ASSISTANT") && String(r.content || "").trim())
    .slice(-limit)
    .forEach((r) => {
      const role = r.senderRole === "ASSISTANT" ? "assistant" : "user";
      const text = String(r.content).trim();
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.text = `${last.text}\n\n${text}`;
      else turns.push({ role, text });
    });
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
