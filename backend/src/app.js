import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes       from "./routes/auth_routes.js";
import dashboardRoutes  from "./routes/dashboard_routes.js";
import bookingRoutes    from "./routes/booking_routes.js";
import paymentRoutes    from "./routes/payment_routes.js";
import receiptRoutes    from "./routes/receipt_routes.js";
import invoiceRoutes    from "./routes/invoice_routes.js";
import operatorRoutes   from "./routes/operator_routes.js";
import configRoutes     from "./routes/config_routes.js";
import logRoutes        from "./routes/log_routes.js";
import customerRoutes   from "./routes/customer_routes.js";
import stripeRoutes     from "./routes/stripe_routes.js";
import emailRoutes      from "./routes/email_routes.js";
import cronRoutes       from "./routes/cron_routes.js";
import hostRoutes       from "./routes/host_routes.js";

import { errorHandler }  from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/logger_middleware.js";

dotenv.config();

const app = express();

function requiredEnvStatus() {
  const required = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`[CONFIG] Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

requiredEnvStatus();

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://bnpl-frontend-brown.vercel.app",
  "https://newfrontbnplplatform.vercel.app",
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  // Allow your own Vercel frontend preview deployments.
  if (
    process.env.NODE_ENV !== "production" &&
    origin.endsWith(".vercel.app") &&
    origin.includes("darren-6969s-projects")
  ) {
    return true;
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-bnpl-api-key"],
  })
);

app.options("*", cors());

// ── Stripe webhook — must come BEFORE express.json() ────────────────────────
app.use("/api/stripe", stripeRoutes);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Request logger ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Static file serving for uploaded receipts ────────────────────────────────
// For production, use object storage and store a public/private URL instead.
app.use("/uploads", express.static("uploads"));

// ── Root / Health check ──────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    message: "BNPL API is running",
    version: "1.0.0",
    status: "ok",
  });
});

app.get("/health", (_req, res) => {
  const config = requiredEnvStatus();

  res.status(config.ok ? 200 : 503).json({
    status: config.ok ? "ok" : "degraded",
    message: "BNPL API health check",
    config,
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings",  bookingRoutes);
app.use("/api/payments",  paymentRoutes);
app.use("/api/receipts",  receiptRoutes);
app.use("/api/invoices",  invoiceRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/config",    configRoutes);
app.use("/api/logs",      logRoutes);
app.use("/api/customer",  customerRoutes);
app.use("/api/emails",    emailRoutes);
app.use("/api/cron",      cronRoutes);
app.use("/api/host",      hostRoutes);

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
