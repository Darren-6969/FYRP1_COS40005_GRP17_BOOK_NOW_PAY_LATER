import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import {
  getTicketById,
  getTicketCounts,
  getTickets,
  postTicketReassign,
  postTicketReply,
  postTicketResolve,
} from "../controllers/support_controller.js";

// Support tickets from the chatbot (Step 9). Operators (NORMAL_SELLER, owner
// or staff) see their own operator's tickets; the admin (MASTER_SELLER)
// sees all of them and can reassign. The controller scopes every query.

const router = express.Router();
const staff = [verifyToken, allowRoles("MASTER_SELLER", "NORMAL_SELLER")];

const replyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many replies at once. Please wait a moment.", code: "RATE_LIMITED" },
});

router.get("/tickets", ...staff, getTickets);
router.get("/tickets/counts", ...staff, getTicketCounts);
router.get("/tickets/:id", ...staff, getTicketById);
router.post("/tickets/:id/replies", ...staff, replyLimiter, postTicketReply);
router.post("/tickets/:id/resolve", ...staff, postTicketResolve);
router.post("/tickets/:id/reassign", verifyToken, allowRoles("MASTER_SELLER"), postTicketReassign);

export default router;
