import prisma from "../config/db.js";
import { buildLogWhere, readLogFilters } from "../services/audit_log_query_service.js";

/**
 * GET /logs (admin). Filtered, paged audit log plus the distinct actions and
 * entity types for the filter dropdowns.
 */
export async function getLogs(req, res, next) {
  try {
    const filters = readLogFilters(req.query);
    const where = buildLogWhere(filters);

    const [total, items, actions, entityTypes] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
      prisma.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
    ]);

    res.json({
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      facets: {
        actions: actions.map((row) => row.action),
        entityTypes: entityTypes.map((row) => row.entityType),
      },
    });
  } catch (err) {
    next(err);
  }
}
