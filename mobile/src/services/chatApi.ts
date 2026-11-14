/**
 * The platform chatbot (backend/src/services/chat, routes in
 * public_routes.js): rule layer, AI answers with the answer check, car and
 * booking cards, and "Talk to a person" support tickets. The same chat the
 * website uses, so its wording comes from the admin Policies and answers
 * page, not from the app.
 *
 * The login token is sent when present, so the server knows the customer
 * (attachChatCustomer); without it the chat works as a visitor.
 */

import { apiRequest } from "./api";

export type ChatAction =
  | { type: "welcome" }
  | { type: "quick"; key: string }
  | { type: "guided"; value: string }
  | { type: "handoff"; value: string }
  | { type: "chip"; key: string };

export type ChatButton = { key: string; label: string; action?: ChatAction };
export type ChatLink = { label: string; href: string };

export type ChatCar = {
  id: number;
  name: string;
  href: string;
  imageUrl?: string | null;
  operator?: string | null;
  seats?: number | null;
  city?: string | null;
  /** Server amounts in integer sen (F16). */
  totalSen?: number | null;
  depositSen?: number | null;
  dailySen?: number | null;
};

export type ChatBooking = {
  code: string;
  car: string;
  status: string;
  dates?: string;
  operator?: string | null;
  facts: { label: string; detail: string; tone?: string }[];
  actions: { label: string; href: string; primary?: boolean }[];
};

export type ChatMessage = {
  id: number | string;
  role: "user" | "assistant" | "staff";
  text?: string;
  createdAt?: string;
  /** Assistant messages. */
  kind?: "text" | "options" | "cars" | "bookings";
  intro?: string;
  actions?: ChatButton[];
  links?: ChatLink[];
  templateKey?: string;
  /** kind "options" (a guided step). */
  optionType?: "guided" | "handoff";
  options?: { value: string; label: string }[];
  stepLabel?: string;
  /** The guided search's step: dates, seats, budget, done. */
  step?: string;
  allowCustomDates?: boolean;
  note?: string;
  /** kind "cars". */
  cars?: ChatCar[];
  chips?: (string | { key: string; label: string })[];
  chipsEditable?: boolean;
  resultsHref?: string;
  total?: number;
  /** kind "bookings". */
  bookings?: ChatBooking[];
  /** Staff replies. */
  from?: string;
  /** App only: sent, waiting for the server. */
  pending?: boolean;
};

export type ChatTicket = { reference: string; status: string; with: string };

export type ChatReply = {
  conversationId: number;
  visitorToken: string | null;
  reply?: ChatMessage | null;
  /** While a ticket is open, a typed message is stored and sent back here instead of a reply. */
  sent?: ChatMessage | null;
  ticket: ChatTicket | null;
};

export async function postChatMessage(body: {
  conversationId?: number;
  visitorToken?: string | null;
  text?: string;
  action?: ChatAction;
}): Promise<ChatReply> {
  return apiRequest("/public/chat/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getChatConversation(
  conversationId: number,
  visitorToken?: string | null
): Promise<{ conversationId: number; messages: ChatMessage[]; ticket: ChatTicket | null }> {
  const query = visitorToken ? `?visitorToken=${encodeURIComponent(visitorToken)}` : "";
  return apiRequest(`/public/chat/conversations/${conversationId}${query}`, { method: "GET" });
}
