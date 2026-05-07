import api from "./api";

export const login = (payload) => api.post("/auth/login", payload);
export const register = (payload) => api.post("/auth/register", payload);
export const getMe = async () => {
  const token = localStorage.getItem("bnpl_token") || localStorage.getItem("token");
  return api.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const updateProfile = (payload) => api.patch("/auth/profile", payload);

export const changePassword = (payload) =>
  api.patch("/auth/change-password", payload);

export const updateNotificationPreferences = (payload) =>
  api.patch("/auth/notification-preferences", payload);