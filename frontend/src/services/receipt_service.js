import api from "./api";

export const getReceipts = () => api.get("/receipts");

export const approveReceipt = (id) =>
  api.patch(`/receipts/${id}/approve`);

export const rejectReceipt = (id) =>
  api.patch(`/receipts/${id}/reject`);