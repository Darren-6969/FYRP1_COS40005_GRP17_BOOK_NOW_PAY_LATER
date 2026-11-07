import { getConversation, handleChatMessage, rateMessage } from "../services/chat/chat_service.js";
import { parseId } from "../utils/parseId.js";

// POST /api/public/chat/messages
export async function postChatMessage(req, res, next) {
  try {
    res.json(await handleChatMessage(req.body, req.chatCustomer || null, { ip: req.ip }));
  } catch (err) {
    next(err);
  }
}

// GET /api/public/chat/conversations/:id?visitorToken=
export async function getChatConversation(req, res, next) {
  try {
    const visitorToken = typeof req.query.visitorToken === "string" ? req.query.visitorToken : null;
    res.json(
      await getConversation({
        conversationId: parseId(req.params.id),
        visitorToken,
        customer: req.chatCustomer || null,
      })
    );
  } catch (err) {
    next(err);
  }
}

// PUT /api/public/chat/conversations/:id/messages/:messageId/feedback
export async function putChatFeedback(req, res, next) {
  try {
    res.json(
      await rateMessage({
        conversationId: parseId(req.params.id),
        messageId: parseId(req.params.messageId),
        visitorToken: req.body.visitorToken || null,
        customer: req.chatCustomer || null,
        feedback: req.body.feedback,
      })
    );
  } catch (err) {
    next(err);
  }
}
