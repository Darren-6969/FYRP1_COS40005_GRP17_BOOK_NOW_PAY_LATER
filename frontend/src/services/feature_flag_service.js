import api from "./api";

export async function getFeatureFlags(operatorId = null) {
  const response = await api.get("/config/feature-flags", {
    params: operatorId == null ? {} : { operatorId },
  });
  return response.data?.flags || {};
}

export function getManagedFeatureFlags() {
  return api.get("/config/feature-flags/manage");
}

export function updateFeatureFlag(payload) {
  return api.patch("/config/feature-flags", payload);
}

export function deleteFeatureFlagOverride({ key, operatorId }) {
  return api.delete("/config/feature-flags", { params: { key, operatorId } });
}
