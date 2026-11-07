import api from "./api";

// Admin console: Policies and answers.
export const getPolicyLibrary = () => api.get("/policies");
export const getSectionVersions = (documentKey, sectionKey) =>
  api.get(`/policies/documents/${documentKey}/sections/${sectionKey}/versions`);
export const createSection = (documentKey, payload) => api.post(`/policies/documents/${documentKey}/sections`, payload);
export const publishSection = (documentKey, sectionKey, payload) =>
  api.post(`/policies/documents/${documentKey}/sections/${sectionKey}`, payload);
export const getTemplateVersions = (key) => api.get(`/policies/templates/${encodeURIComponent(key)}/versions`);
export const publishTemplate = (key, payload) => api.post(`/policies/templates/${encodeURIComponent(key)}`, payload);

// Public: current wording of one document, for the info pages.
export const getPublicPolicy = (documentKey) => api.get(`/public/policies/${documentKey}`);
