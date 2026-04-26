import api from "./api";

export const getDashboardStats = () => api.get("/dashboard/stats");

export const getBookings = () => api.get("/bookings");
export const acceptBooking = (id) => api.patch(`/bookings/${id}/accept`);
export const rejectBooking = (id) => api.patch(`/bookings/${id}/reject`);

export const getPayments = () => api.get("/payments");

export const getReceipts = () => api.get("/receipts");
export const approveReceipt = (id) => api.patch(`/receipts/${id}/approve`);
export const rejectReceipt = (id, remarks) =>
  api.patch(`/receipts/${id}/reject`, { remarks });

export const getInvoices = () => api.get("/invoices");
export const generateInvoice = (bookingId) =>
  api.post(`/invoices/generate/${bookingId}`);

export const getOperators = () => api.get("/operators");
export const updateOperatorStatus = (id, status) =>
  api.patch(`/operators/${id}/status`, { status });

export const getBNPLConfigs = () => api.get("/config/bnpl");
export const updateBNPLConfig = (operatorId, data) =>
  api.patch(`/config/bnpl/${operatorId}`, data);