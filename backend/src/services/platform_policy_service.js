import prisma from "../config/db.js";

export async function getPlatformDeadlinePolicy() {
  return prisma.platformDeadlinePolicy.upsert({
    where: { id: 1 },
    create: { id: 1, publishedTiers: [1, 3, 7], mostLenientDays: 7 },
    update: {},
  });
}

export function validatePublishedDeadline(policy, days) {
  return Number.isInteger(days)
    && days <= policy.mostLenientDays
    && policy.publishedTiers.includes(days);
}

export async function isPlatformPeakDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const peak = await prisma.platformPeakDate.findUnique({ where: { peakDate: day } });
  return Boolean(peak);
}