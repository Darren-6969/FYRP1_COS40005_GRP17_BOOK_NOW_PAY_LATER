import api from "./api";

export const claimHostBookingIntent = (token) =>
  api.post(`/host/booking-intents/${token}/claim`);