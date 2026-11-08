import { z } from "zod";
import {
  getTicket,
  listTickets,
  reassignTicket,
  scopeFromUser,
  staffReply,
  staffResolve,
  ticketCounts,
} from "../services/support/support_ticket_service.js";
import { TOPIC_KEYS } from "../services/support/support_rules.js";
import { parseId } from "../utils/parseId.js";

// Support tickets for the operator Customer messages page and the admin
// Support page (development plan Step 9). Which tickets a user sees comes
// from their session: an operator only ever gets their own operator's.

function scopeOr403(req, res) {
  const scope = scopeFromUser(req.user);
  if (!scope) res.status(403).json({ message: "Not allowed", code: "SUPPORT_FORBIDDEN" });
  return scope;
}

const listQuery = z.object({
  status: z.enum(["ACTIVE", "OPEN", "ANSWERED", "RESOLVED", "ALL"]).optional(),
  topic: z.enum(TOPIC_KEYS).optional(),
  route: z.enum(["OPERATOR", "ADMIN"]).optional(),
  operatorId: z.coerce.number().int().positive().optional(),
  overdue: z.enum(["1", "true"]).optional(),
});

// GET /api/support/tickets
export async function getTickets(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid filters" });
    const { overdue, ...rest } = parsed.data;
    res.json(await listTickets(scope, { ...rest, overdue: Boolean(overdue) }));
  } catch (err) {
    next(err);
  }
}

// GET /api/support/tickets/counts
export async function getTicketCounts(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    res.json(await ticketCounts(scope));
  } catch (err) {
    next(err);
  }
}

// GET /api/support/tickets/:id
export async function getTicketById(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    res.json(await getTicket(scope, parseId(req.params.id)));
  } catch (err) {
    next(err);
  }
}

// POST /api/support/tickets/:id/replies  { text }
export async function postTicketReply(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    res.json(await staffReply(scope, parseId(req.params.id), req.body?.text));
  } catch (err) {
    next(err);
  }
}

// POST /api/support/tickets/:id/resolve
export async function postTicketResolve(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    res.json(await staffResolve(scope, parseId(req.params.id)));
  } catch (err) {
    next(err);
  }
}

const reassignBody = z.object({
  route: z.enum(["OPERATOR", "ADMIN"]),
  operatorId: z.coerce.number().int().positive().optional().nullable(),
});

// POST /api/support/tickets/:id/reassign  { route, operatorId }  (admin only)
export async function postTicketReassign(req, res, next) {
  try {
    const scope = scopeOr403(req, res);
    if (!scope) return;
    const parsed = reassignBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "Pick where the ticket should go." });
    res.json(await reassignTicket(scope, parseId(req.params.id), parsed.data));
  } catch (err) {
    next(err);
  }
}
