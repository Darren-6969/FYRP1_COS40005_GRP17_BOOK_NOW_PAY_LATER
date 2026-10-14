import api from "./api";
import { getRefreshToken } from "../utils/session";

export const login = (payload) => api.post("/auth/login", payload);
export const register = (payload) => api.post("/auth/register", payload);
export const forgotPassword = (payload) => api.post("/auth/forgot-password", payload);
export const resetPassword = (payload) => api.post("/auth/reset-password", payload);
export const getMe = () => api.get("/auth/me");

export const logout = () =>
  api.post("/auth/logout", { refreshToken: getRefreshToken() });

export const updateProfile = (payload) => api.patch("/auth/profile", payload);

export const changePassword = (payload) =>
  api.patch("/auth/change-password", payload);

export const updateNotificationPreferences = (payload) =>
  api.patch("/auth/notification-preferences", payload);