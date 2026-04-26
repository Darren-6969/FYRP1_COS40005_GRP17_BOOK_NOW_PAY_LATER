import api from "./api";

export const getCustomerBookings = () => api.get("/customer/bookings");

export const createCustomerBooking = (payload) =>
  api.post("/customer/bookings", payload);

export const getCustomerBookingById = (id) =>
  api.get(`/customer/bookings/${id}`);

export const cancelCustomerBooking = (id) =>
  api.patch(`/customer/bookings/${id}/cancel`);

export const getCustomerBookingActivity = (id) =>
  api.get(`/customer/bookings/${id}/activity`);

export const payCustomerBooking = (id, payload) =>
  api.post(`/customer/bookings/${id}/pay`, payload);

export const uploadCustomerReceipt = (id, payload) =>
  api.post(`/customer/bookings/${id}/receipt`, payload);

export const getCustomerPayments = () => api.get("/customer/payments");

export const getCustomerInvoices = () => api.get("/customer/invoices");

export const getCustomerInvoiceById = (id) =>
  api.get(`/customer/invoices/${id}`);

export const getCustomerNotifications = () =>
  api.get("/customer/notifications");

export const markCustomerNotificationRead = (id) =>
  api.patch(`/customer/notifications/${id}/read`);

export const markAllCustomerNotificationsRead = () =>
  api.patch("/customer/notifications/read-all");
