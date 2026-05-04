import api from "./api";

export const login = (payload) => api.post("/auth/login", payload);
export const register = (payload) => api.post("/auth/register", payload);
export const getMe = () => api.get("/auth/me");

export const updateProfile = (payload) => api.patch("/auth/profile", payload);

export const changePassword = (payload) =>
  api.patch("/auth/change-password", payload);

export const updateNotificationPreferences = (payload) =>
  api.patch("/auth/notification-preferences", payload);