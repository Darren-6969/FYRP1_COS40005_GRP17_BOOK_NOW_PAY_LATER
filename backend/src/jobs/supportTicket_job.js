import cron from "node-cron";
import { autoResolveAnswered } from "../services/support/support_ticket_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

// Step 9: a ticket staff answered, with no reply from the customer for 3
// days, is resolved (chatbot design, "Ticket lifecycle").
export function runSupportTicketJob() {
  return runLoggedCronJob("SUPPORT_TICKET_AUTO_RESOLVE", async () => {
    const result = await autoResolveAnswered();
    return { ...result, processedCount: result.resolvedCount, failureCount: 0, errors: [] };
  });
}

export function startSupportTicketJob() {
  cron.schedule(
    "15 * * * *",
    async () => {
      try {
        const result = await runSupportTicketJob();
        if (result?.resolvedCount) console.log(`[SupportTickets] Auto-resolved ${result.resolvedCount}`);
      } catch (err) {
        console.error("[SupportTickets] Hourly check failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );
  console.log("[SupportTickets] Scheduler started (hourly)");
}
