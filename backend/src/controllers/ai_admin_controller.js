import {
  confirmAiPrices,
  getAiOverview,
  reorderAiModels,
  setLiveMode,
  updateAiModel,
  updateAiSettings,
} from "../services/ai/ai_admin_service.js";
import { parseId } from "../utils/parseId.js";

// Admin AI models page (development plan Step 11). Admin only; every change
// is logged with req.user as the person who made it.

// Client errors get an appCode so the page can branch on `code`; the shared
// error handler then answers { code, message, request_id, details }.
function appCodeFor(err) {
  if (err.blockers) return "AI_LIVE_MODE_BLOCKED";
  if (err.statusCode === 409) return "AI_MODEL_BLOCKED";
  if (err.statusCode === 404) return "AI_MODEL_NOT_FOUND";
  return "AI_ADMIN_INVALID";
}

function send(res, next, promise) {
  promise
    .then((data) => res.json(data))
    .catch((err) => {
      if (err.statusCode && err.statusCode < 500) {
        err.appCode = err.appCode || appCodeFor(err);
        if (err.blockers) err.details = { blockers: err.blockers };
      }
      return next(err);
    });
}

// GET /api/ai-admin/overview
export const getOverview = (req, res, next) => send(res, next, getAiOverview());

// PATCH /api/ai-admin/models/:id
export const patchModel = (req, res, next) => send(res, next, updateAiModel({ id: parseId(req.params.id), body: req.body, user: req.user }));

// POST /api/ai-admin/models/:id/prices-checked
export const postPricesChecked = (req, res, next) => send(res, next, confirmAiPrices({ id: parseId(req.params.id), user: req.user }));

// PUT /api/ai-admin/models/order  { ids: [...] }
export const putOrder = (req, res, next) => send(res, next, reorderAiModels({ ids: req.body?.ids, user: req.user }));

// PATCH /api/ai-admin/settings
export const patchSettings = (req, res, next) => send(res, next, updateAiSettings({ body: req.body, user: req.user }));

// PUT /api/ai-admin/live-mode  { on }
export const putLiveMode = (req, res, next) => send(res, next, setLiveMode({ on: req.body?.on, user: req.user }));
