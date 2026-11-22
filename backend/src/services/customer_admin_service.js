// The admin Customers page: a searchable list of customer accounts and one
// customer's detail (profile, bookings, refunds, licence status, support
// requests). Admin only (MASTER_SELLER); the routes enforce the role.
// Licence and permit files are never returned here, only their status.

import prisma from "../config/db.js";
import { DELETED_CUSTOMER_STATUS } from "./account_deletion_rules.js";
import { openDeletionRequest } from "./account_deletion_request_service.js";

export const CUSTOMER_STATUS_FILTERS = ["ALL", "ACTIVE", "RESTRICTED", DELETED_CUSTOMER_STATUS];
const MAX_PAGE_SIZE = 50;
const DETAIL_BOOKING_LIMIT = 100;

function notFound() {
  const err = new Error("Customer not found");
  err.statusCode = 404;
  err.appCode = "CUSTOMER_NOT_FOUND";
  return err;
}

function searchWhere(q) {
  const term = String(q || "").trim().slice(0, 100);
  if (!term) return {};
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { userCode: { contains: term, mode: "insensitive" } },
    ],
  };
}

function statusWhere(status) {
  if (!status || status === "ALL") return {};
  if (status === "ACTIVE") return { customerStatus: { notIn: ["RESTRICTED", DELETED_CUSTOMER_STATUS] } };
  return { customerStatus: status };
}

/**
 * { q, status, page, pageSize } -> { customers, total, page, pageSize, counts }
 * counts are for the whole customer base, not the search, so the summary
 * tiles stay steady while the admin types.
 */
export async function listCustomers({ q, status = "ALL", page = 1, pageSize = 20 } = {}, db = prisma) {
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);
  const current = Math.max(Number(page) || 1, 1);
  const where = { role: "CUSTOMER", ...statusWhere(status), ...searchWhere(q) };

  const [rows, total, all, restricted, deleted] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * size,
      take: size,
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        phone: true,
        customerStatus: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    }),
    db.user.count({ where }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", customerStatus: "RESTRICTED" } }),
    db.user.count({ where: { role: "CUSTOMER", customerStatus: DELETED_CUSTOMER_STATUS } }),
  ]);

  return {
    customers: rows.map(({ _count, ...row }) => ({ ...row, bookingCount: _count.bookings })),
    total,
    page: current,
    pageSize: size,
    counts: { all, active: all - restricted - deleted, restricted, deleted },
  };
}

/** One customer for the detail page. Throws 404 for anyone who isn't a customer. */
export async function getCustomer(userId, db = prisma) {
  const user = await db.user.findFirst({
    where: { id: userId, role: "CUSTOMER" },
    select: {
      id: true,
      userCode: true,
      name: true,
      email: true,
      phone: true,
      customerStatus: true,
      provisionedVia: true,
      emailVerifiedAt: true,
      termsAcceptedAt: true,
      privacyPolicyAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) throw notFound();

  const [bookings, bookingTotal, refunds, licence, tickets, deletionRequest] = await Promise.all([
    db.booking.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      take: DETAIL_BOOKING_LIMIT,
      select: {
        id: true,
        bookingCode: true,
        status: true,
        serviceName: true,
        pickupDate: true,
        returnDate: true,
        totalAmount: true,
        createdAt: true,
        operator: { select: { id: true, companyName: true } },
        payment: { select: { status: true } },
      },
    }),
    db.booking.count({ where: { customerId: userId } }),
    db.refund.findMany({
      where: { booking: { customerId: userId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        createdAt: true,
        booking: { select: { id: true, bookingCode: true } },
      },
    }),
    db.customerLicenceDocument.findFirst({
      where: { customerId: userId },
      orderBy: { submittedAt: "desc" },
      select: { status: true, submittedAt: true, reviewedAt: true },
    }),
    db.chatEscalation.findMany({
      where: { conversation: { customerId: userId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, reference: true, topic: true, status: true, createdAt: true },
    }),
    openDeletionRequest(userId, db),
  ]);

  return {
    customer: user,
    bookings: bookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) })),
    bookingTotal,
    refunds: refunds.map((r) => ({ ...r, amount: Number(r.amount) })),
    licence,
    tickets,
    deletionRequest: deletionRequest
      ? { reference: deletionRequest.reference, status: deletionRequest.status, requestedAt: deletionRequest.createdAt }
      : null,
  };
}

/** The customer with this exact email, for a signed-out deletion request. */
export async function findCustomerByEmail(email, db = prisma) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return null;
  return db.user.findFirst({
    where: { role: "CUSTOMER", email: { equals: value, mode: "insensitive" } },
    select: { id: true },
  });
}
