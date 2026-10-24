// Public platform facts for signed-out pages.
import api from "./api";

// GET /api/public/subscription-tiers (FR-CUST-010): subscription tiers, the
// commission rate and the operator activity rule, all from PlatformSettings.
export function getRecruitPlans() {
  return api.get("/public/subscription-tiers").then((r) => r.data);
}

// GET /api/public/sign-in-panel (R6): per surface ("customer", "operator"),
// either { mode: "default" } or the admin image to show beside the form.
export function getSignInPanel() {
  return api.get("/public/sign-in-panel").then((r) => r.data);
}
