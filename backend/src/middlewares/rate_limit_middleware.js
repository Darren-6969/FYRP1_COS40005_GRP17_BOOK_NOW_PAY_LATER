import rateLimit from "express-rate-limit";

// OWASP 2025 A07 – Authentication failures: strict limit on login/register
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again after 15 minutes." },
  skipSuccessfulRequests: false,
});

// Prevent brute-force against the refresh-token endpoint separately
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many token refresh requests. Please try again later." },
});

// PCI DSS Req 6.4 – protect payment initiation endpoints
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment requests. Please try again after 15 minutes." },
});

// General API guard – prevents API enumeration / DDoS (OWASP A05 2025)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
