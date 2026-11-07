import api from "./api";

// Admin AI models page (Step 11).
export const getAiOverview = () => api.get("/ai-admin/overview");
export const updateAiModel = (id, body) => api.patch(`/ai-admin/models/${id}`, body);
export const confirmAiPrices = (id) => api.post(`/ai-admin/models/${id}/prices-checked`);
export const reorderAiModels = (ids) => api.put("/ai-admin/models/order", { ids });
export const updateAiSettings = (body) => api.patch("/ai-admin/settings", body);
export const setAiLiveMode = (on) => api.put("/ai-admin/live-mode", { on });
