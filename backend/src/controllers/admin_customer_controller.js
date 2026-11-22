import { z } from "zod";
import {
  CUSTOMER_STATUS_FILTERS,
  findCustomerByEmail,
  getCustomer,
  listCustomers,
} from "../services/customer_admin_service.js";
import { deleteCustomerAccount, previewDeletion } from "../services/account_deletion_service.js";
import { parseId } from "../utils/parseId.js";

// Admin Customers page (MASTER_SELLER only, enforced in the routes): the
// customer list and detail, and deleting an account on the customer's request.

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(CUSTOMER_STATUS_FILTERS).optional(),
  page: z.coerce.number().int().positive().max(10_000).optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

const lookupQuery = z.object({ email: z.string().trim().email().max(254) });

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(3).max(254),
});

function badFilters(res) {
  return res.status(400).json({ message: "Invalid filters", code: "INVALID_FILTERS" });
}

// GET /api/admin/customers
export async function getCustomers(req, res, next) {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return badFilters(res);
    res.json(await listCustomers(parsed.data));
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/customers/lookup?email=
// For a deletion request sent while signed out: finds the account by email.
export async function lookupCustomer(req, res, next) {
  try {
    const parsed = lookupQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email address.", code: "INVALID_EMAIL" });
    const customer = await findCustomerByEmail(parsed.data.email);
    if (!customer) return res.status(404).json({ message: "No customer account uses that email.", code: "CUSTOMER_NOT_FOUND" });
    res.json({ id: customer.id });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/customers/:id
export async function getCustomerById(req, res, next) {
  try {
    res.json(await getCustomer(parseId(req.params.id, "customer id")));
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/customers/:id/deletion
export async function getDeletionPreview(req, res, next) {
  try {
    res.json(await previewDeletion(parseId(req.params.id, "customer id")));
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/customers/:id/deletion  { confirmEmail }
export async function postDeletion(req, res, next) {
  try {
    const userId = parseId(req.params.id, "customer id");
    const result = await deleteCustomerAccount({ userId, confirmEmail: req.body.confirmEmail, req });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
