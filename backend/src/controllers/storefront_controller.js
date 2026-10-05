import {
  getOwnStorefront,
  getStorefront,
  listFeaturedOperators,
  updateOwnStorefront,
} from "../services/operator_storefront_service.js";

// GET /api/public/operators/:handle (slug or id)
export async function getOperatorStorefront(req, res, next) {
  try {
    res.json(await getStorefront(req.params.handle));
  } catch (err) {
    next(err);
  }
}

// GET /api/public/operators?city=&limit=
export async function listOperators(req, res, next) {
  try {
    res.json({ items: await listFeaturedOperators({ city: req.query.city, limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
}

// GET /api/operators/storefront
export async function getMyStorefront(req, res, next) {
  try {
    res.json(await getOwnStorefront(req.user.operatorId));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/operators/storefront
export async function updateMyStorefront(req, res, next) {
  try {
    res.json(await updateOwnStorefront(req.user.operatorId, req.body || {}));
  } catch (err) {
    next(err);
  }
}
