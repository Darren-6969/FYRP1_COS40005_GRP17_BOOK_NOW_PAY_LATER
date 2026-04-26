import api from "./api";

export const getOperators = () => api.get("/operators");

export const updateOperatorStatus = (id, status) =>
  api.patch(`/operators/${id}/status`, { status });