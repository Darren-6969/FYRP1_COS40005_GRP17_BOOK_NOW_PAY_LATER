import { getPlatformSettings } from "../services/platform_settings_service.js";
import { publicSignInPanel } from "../services/sign_in_panel_service.js";
import { publicPlanSummary } from "../services/public_plans_service.js";

// GET /api/public/subscription-tiers (FR-CUST-010)
export async function getSubscriptionPlans(req, res, next) {
  try {
    const settings = await getPlatformSettings();
    // Short cache: a tier change in the admin console shows within a minute.
    res.set("Cache-Control", "public, max-age=60");
    res.json(publicPlanSummary(settings));
  } catch (err) {
    next(err);
  }
}

// GET /api/public/sign-in-panel (R6): which panel the sign-in pages and the
// operator register page show, the default illustration or an admin image.
export async function getSignInPanel(req, res, next) {
  try {
    const settings = await getPlatformSettings();
    res.set("Cache-Control", "public, max-age=60");
    res.json(publicSignInPanel(settings));
  } catch (err) {
    next(err);
  }
}
