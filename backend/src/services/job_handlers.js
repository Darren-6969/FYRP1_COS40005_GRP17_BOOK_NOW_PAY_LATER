import { ANALYTICS_JOB_TYPE, handleAnalyticsEvent } from "./analytics_service.js";

// The handler for each job type. Every handler must be idempotent (FR-ARCH-001):
// a lease expiry can make the same job run twice.
export const JOB_HANDLERS = {
  [ANALYTICS_JOB_TYPE]: handleAnalyticsEvent,
};
