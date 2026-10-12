import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

// Verifies a short-lived access token (Bearer <jwt>)
export async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Distinguish between expired and invalid so the client can decide to refresh
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { operator: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid token user" });
    }

    if (user.role === "NORMAL_SELLER" && user.operator?.status !== "ACTIVE") {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      return res.status(403).json({
        message: user.operator?.status === "PENDING"
          ? "Your operator application is awaiting administrator approval."
          : "Your operator account is not active. Please contact the administrator.",
        code: user.operator?.status === "PENDING"
          ? "OPERATOR_APPLICATION_PENDING"
          : "OPERATOR_ACCOUNT_INACTIVE",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// For public endpoints that only want to know who is signed in, if anyone, to
// attribute an analytics event. It never rejects a request and never sets
// req.user, so it cannot grant access to anything.
export function attachUserIdIfPresent(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
      if (Number.isInteger(decoded?.id)) req.analyticsUserId = decoded.id;
    }
  } catch {
    // An expired or invalid token just means the visitor counts as signed out.
  }
  next();
}

// Blocks host-provisioned customers who haven't completed OTP step-up from
// credit-committing actions. Verified customers (customerStatus ACTIVE) pass.
export function requireVerifiedCustomer(req, res, next) {
  if (req.user?.role === "CUSTOMER" && req.user.customerStatus === "RESTRICTED") {
    return res.status(403).json({
      message: "Please verify your identity with the emailed code to continue.",
      code: "OTP_REQUIRED",
    });
  }
  next();
}