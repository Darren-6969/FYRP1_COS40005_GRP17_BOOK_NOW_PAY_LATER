import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";
import { startOverdueBookingCron } from "./services/cron_service.js";
import { startIdempotencyCleanupJob } from "./jobs/idempotencyCleanup_job.js";
import { startStripeWebhookWorker } from "./jobs/stripeWebhook_worker.js";
import { startOperatorPayoutJob } from "./jobs/operatorPayout_job.js";
import { startSubscriptionLifecycleJob } from "./jobs/subscriptionLifecycle_job.js";
import { startOperatorInactivityJob } from "./jobs/operatorInactivity_job.js";
import { startJobQueueWorker } from "./jobs/jobQueue_worker.js";
import { startRefundDeadlineJob } from "./jobs/refundDeadline_job.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);
startOverdueBookingCron();
startIdempotencyCleanupJob();
startStripeWebhookWorker();
startOperatorPayoutJob();
startSubscriptionLifecycleJob();
startOperatorInactivityJob();
startJobQueueWorker();
startRefundDeadlineJob();

server.listen(PORT, () => {
  console.log(`BNPL backend running on http://localhost:${PORT}`);
  console.log("Socket.IO real-time notification server is active");
});