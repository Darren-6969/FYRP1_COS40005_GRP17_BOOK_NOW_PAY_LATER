import api from "./api";

export const getDashboardStats = () => api.get("/dashboard/stats");

export const getBookings = (params = {}) => api.get("/bookings", { params });
export const acceptBooking = (id) => api.patch(`/bookings/${id}/accept`);
export const rejectBooking = (id) => api.patch(`/bookings/${id}/reject`);

export const getPayments = (params = {}) => api.get("/payments", { params });

export const getReceipts = (params = {}) => api.get("/receipts", { params });
export const approveReceipt = (id) => api.patch(`/receipts/${id}/approve`);
export const rejectReceipt = (id, remarks) =>
  api.patch(`/receipts/${id}/reject`, { remarks });

export const getInvoices = (params = {}) => api.get("/invoices", { params });
export const generateInvoice = (bookingId) =>
  api.post(`/invoices/generate/${bookingId}`);

export const getOperators = () => api.get("/operators");
export const createOperator = (payload) => api.post("/operators", payload);
export const updateOperatorStatus = (id, status) =>
  api.patch(`/operators/${id}/status`, { status });
export const deleteOperator = (id) => api.delete(`/operators/${id}`);

export const getBNPLConfigs = () => api.get("/config/bnpl");
export const getBNPLConfig = (operatorId) => api.get(`/config/bnpl/${operatorId}`);
export const updateBNPLConfig = (operatorId, data) =>
  api.patch(`/config/bnpl/${operatorId}`, data);

export const getSystemLogs = (params = {}) => api.get("/logs", { params });
export const getEmailLogs = (params = {}) => api.get("/emails", { params });

export const getCronStatus = () => api.get("/cron/status");
export const getCronHistory = (params = {}) =>
  api.get("/cron/history", { params });

export const runOverdueCheck = () => api.post("/cron/run-overdue-check");
export const runCompletionCheck = () => api.post("/cron/run-completion-check");
export const runPaymentReminderCheck = () =>
  api.post("/cron/run-payment-reminders");
export const runNoResponseCheck = () => api.post("/cron/run-no-response-check");
export const runMaintenanceChecks = () => api.post("/cron/run-maintenance-checks");