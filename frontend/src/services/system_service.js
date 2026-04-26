import api from "./api";

export const getLogs = () => api.get("/logs");

export const getBNPLConfig = () => api.get("/config/bnpl");

export const updateBNPLConfig = (data) =>
  api.patch("/config/bnpl", data);