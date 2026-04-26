import api from "./api";

export const getPayments = () => api.get("/payments");
export const getOverduePayments = () => api.get("/payments/overdue");