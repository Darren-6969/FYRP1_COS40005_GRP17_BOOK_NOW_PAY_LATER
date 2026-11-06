import api from "./api";

// Support tickets raised from the chatbot (Step 9). The same calls serve the
// operator Customer messages page and the admin Support page: the server
// decides which tickets the signed-in user may see.

export const getSupportTickets = (params = {}) => api.get("/support/tickets", { params });

export const getSupportTicketCounts = () => api.get("/support/tickets/counts");

export const getSupportTicket = (id) => api.get(`/support/tickets/${id}`);

export const replyToSupportTicket = (id, text) => api.post(`/support/tickets/${id}/replies`, { text });

export const resolveSupportTicket = (id) => api.post(`/support/tickets/${id}/resolve`);

export const reassignSupportTicket = (id, body) => api.post(`/support/tickets/${id}/reassign`, body);
