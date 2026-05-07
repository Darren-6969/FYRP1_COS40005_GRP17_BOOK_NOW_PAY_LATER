import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { generalLimiter } from "./middlewares/rate_limit_middleware.js";

dotenv.config();

const app = express();

function requiredEnvStatus() {
  const required = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`[CONFIG] Missing required environment variables: ${missing.join(", ")}`);
  }

  return { ok: missing.length === 0, missing };
}

requiredEnvStatus();

// ── Security headers (OWASP A05 2025 / PCI DSS Req 6.3) ─────────────────────
app.use(
  helmet({
    // Content-Security-Policy: restrict resource origins
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // HSTS – force HTTPS for 1 year (PCI DSS Req 4.2 / GDPR Art. 32)
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME sniffing (OWASP A03)
    noSniff: true,
    // Deny framing – click-jacking protection
    frameguard: { action: "deny" },
    // Remove X-Powered-By fingerprint
    hidePoweredBy: true,
    // XSS filter (legacy browsers)
    xssFilter: true,
    // Referrer policy – do not leak URL to third parties (GDPR)
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Prevent cross-origin resource leaks
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
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

  // Allow preview deployments only outside production
  if (
    process.env.NODE_ENV !== "production" &&
    /^https:\/\/[a-z0-9-]+-darren-6969s-projects\.vercel\.app$/.test(origin)
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
    exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  })
);

app.options("*", cors());

// ── Global rate limiting (OWASP A05 2025) ───────────────────────────────────
app.use(generalLimiter);

// ── Stripe webhook – must come BEFORE express.json() ────────────────────────
app.use("/api/stripe", stripeRoutes);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

// ── Request logger ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Static uploads – only in non-production; use object storage in prod ─────
if (process.env.NODE_ENV !== "production") {
  app.use("/uploads", (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  next();
}, express.static("uploads"));
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ message: "BNPL API is running", version: "1.0.0", status: "ok" });
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
