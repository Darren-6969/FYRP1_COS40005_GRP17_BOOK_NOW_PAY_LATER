import api from "./api";

// Chat window (FR-CHAT). The signed-in customer, if any, comes from the token
// the api client already sends; a visitor is recognised by visitorToken.
export const postChatMessage = (body) => api.post("/public/chat/messages", body);

export const getChatConversation = (conversationId, visitorToken) =>
  api.get(`/public/chat/conversations/${conversationId}`, { params: visitorToken ? { visitorToken } : {} });

export const putChatFeedback = (conversationId, messageId, body) =>
  api.put(`/public/chat/conversations/${conversationId}/messages/${messageId}/feedback`, body);
