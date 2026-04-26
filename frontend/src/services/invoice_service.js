import api from "./api";

export const getInvoices = () => api.get("/invoices");

export const sendInvoice = (id) =>
  api.post(`/invoices/${id}/send`);