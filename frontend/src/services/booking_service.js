import api from "./api";

export const getBookings = () => api.get("/bookings");

export const acceptBooking = (id) =>
  api.patch(`/bookings/${id}/accept`);

export const rejectBooking = (id) =>
  api.patch(`/bookings/${id}/reject`);