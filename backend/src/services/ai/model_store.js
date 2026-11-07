// Database side of the model router: which models are switched on, and each
// model's failure count and skip time on its ai_models row.

import prisma from "../../config/db.js";

export function loadEnabledModels() {
  return prisma.aiModel.findMany({ where: { enabled: true }, orderBy: [{ position: "asc" }, { id: "asc" }] });
}

/** Adds one to the model's failures in a row and returns the new count. */
export async function recordModelFailure(model) {
  const row = await prisma.aiModel.update({
    where: { id: model.id },
    data: { consecutiveFailures: { increment: 1 } },
    select: { consecutiveFailures: true },
  });
  return row.consecutiveFailures;
}

/** Skips the model until the given time; its count starts again after. */
export function skipModel(model, until) {
  return prisma.aiModel.update({ where: { id: model.id }, data: { skippedUntil: until, consecutiveFailures: 0 } });
}

export function recordModelSuccess(model) {
  return prisma.aiModel.update({ where: { id: model.id }, data: { consecutiveFailures: 0, skippedUntil: null } });
}
