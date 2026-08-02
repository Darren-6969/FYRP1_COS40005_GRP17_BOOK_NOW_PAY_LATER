import api from "./api";

export const claimHostBookingIntent = (token) =>
  api.post(`/host/booking-intents/${token}/claim`);

export const exchangeHostSession = (handoffToken) =>
  api.post(`/host/session/exchange`, { handoffToken });

export const requestHostOtp = () => api.post(`/host/session/otp/request`);

export const verifyHostOtp = (otp) => api.post(`/host/session/otp/verify`, { otp });