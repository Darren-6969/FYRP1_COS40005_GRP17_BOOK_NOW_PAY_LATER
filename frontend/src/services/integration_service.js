import api from "./api";

export const getIntegration = () => api.get("/operators/integration");
export const rotateApiKey = () => api.post("/operators/integration/api-key/rotate");
export const revokeApiKey = () => api.delete("/operators/integration/api-key");
export const updateOrigins = (allowedOrigins) =>
  api.put("/operators/integration/origins", { allowedOrigins });