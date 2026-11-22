import { getDeletionRequestStatus, requestAccountDeletion } from "../services/account_deletion_request_service.js";

// The signed-in customer's own deletion request (web profile and app).
// Routes sit behind verifyToken + allowRoles("CUSTOMER") in customer_routes.

// GET /api/customer/account-deletion-request
export async function getAccountDeletionRequest(req, res, next) {
  try {
    res.json(await getDeletionRequestStatus(req.user));
  } catch (err) {
    next(err);
  }
}

// POST /api/customer/account-deletion-request
export async function postAccountDeletionRequest(req, res, next) {
  try {
    const result = await requestAccountDeletion(req.user);
    res.status(result.existing ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
}
