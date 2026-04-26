import api from "./api";

export const login = (payload) => api.post("/auth/login", payload);
export const getMe = () => api.get("/auth/me");