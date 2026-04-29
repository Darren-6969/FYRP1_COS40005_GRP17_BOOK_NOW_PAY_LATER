import api from "./api";

export const getInvoices = (params = {}) => api.get("/invoices", { params });

export const sendInvoice = (id) => api.post(`/invoices/${id}/send`);

export const voidInvoice = (id) => api.patch(`/invoices/${id}/void`);