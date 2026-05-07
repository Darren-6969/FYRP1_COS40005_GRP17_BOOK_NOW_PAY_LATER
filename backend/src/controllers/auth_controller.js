import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/db.js";

// ── Token configuration ───────────────────────────────────────────────────────
// Access token: short-lived (OWASP 2025 A07 / NIST SP 800-63B)
const ACCESS_TOKEN_EXPIRY  = "1h";
// Refresh token: longer-lived but stored in DB and revocable
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getRolePrefix(role) {
  const prefixMap = {
    CUSTOMER: "CUS",
    NORMAL_SELLER: "OPR",
    MASTER_SELLER: "ADN",
  };
  return prefixMap[role] || "USR";
}

async function generateUserCode(role) {
  const prefix = getRolePrefix(role);

  const latestUser = await prisma.user.findFirst({
    where: { role, userCode: { startsWith: prefix } },
    orderBy: { userCode: "desc" },
    select: { userCode: true },
  });

  let nextNumber = 1;
  if (latestUser?.userCode) {
    const parsed = Number(latestUser.userCode.replace(prefix, ""));
    if (Number.isInteger(parsed) && parsed > 0) nextNumber = parsed + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    userCode: user.userCode,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    profileImageUrl: user.profileImageUrl || "",
    notifyBookingUpdates: Boolean(user.notifyBookingUpdates),
    notifyPaymentReminders: Boolean(user.notifyPaymentReminders),
    notifyInvoices: Boolean(user.notifyInvoices),
    notifyPromotions: Boolean(user.notifyPromotions),
    operatorId: user.operatorId || null,
    operator: user.operator || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isValidProfileImage(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  return value.startsWith("data:image/") || value.startsWith("https://");
}

// Hash a plain refresh token for storage (never store raw token)
function hashToken(plain) {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

async function issueTokenPair(userId, role) {
  const secret = process.env.JWT_SECRET;

  // Short-lived access token
  const accessToken = jwt.sign({ id: userId, role }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  // Opaque refresh token – stored as a hash in the DB
  const plainRefresh = crypto.randomBytes(40).toString("hex");
  const tokenHash    = hashToken(plainRefresh);
  const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
   data: { tokenHash, userId, expiresAt },
  });

  return { accessToken, refreshToken: plainRefresh };
}

async function createCustomerWithRetry({ name, email, password }) {
  const safeRole      = "CUSTOMER";
  const hashedPassword = await bcrypt.hash(password, 12); // cost factor 12

  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const userCode = await generateUserCode(safeRole);
      return await prisma.user.create({
        data: { userCode, name, email, password: hashedPassword, role: safeRole },
      });
    } catch (err) {
      lastError = err;
      if (err.code !== "P2002") throw err;

      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(",")
        : String(err.meta?.target || "");
      if (!target.includes("userCode")) throw err;
    }
  }

  throw lastError;
}

// ── Register ─────────────────────────────────────────────────────────────────
export async function register(req, res, next) {
  try {
    // Input already validated and sanitised by Zod middleware
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already exists. Please login instead." });
    }

    const user = await createCustomerWithRetry({ name, email, password });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: String(user.id),
      },
    });

    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Duplicate value detected. Please try again." });
    }
    next(err);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(req, res, next) {
  try {
    // Input already validated by Zod middleware
    const { email, password } = req.body;

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { operator: true },
    });

    // Constant-time-safe: always compare even when user not found
    const dummyHash = "$2a$12$invalidhashplaceholderinvalidhashplaceholderinvalid";
    const valid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: "LOGIN_FAILED",
          entityType: "User",
          entityId: email,
          details: { reason: "invalid_credentials" },
        },
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: String(user.id),
      },
    });

    res.json({ token: accessToken, refreshToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

// ── Refresh access token ──────────────────────────────────────────────────────
export async function refreshAccessToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { operator: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Delete expired record if found
      if (stored) await prisma.refreshToken.delete({ where: { tokenHash } });
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Rotate the refresh token (token rotation – OWASP 2025 A07)
    await prisma.refreshToken.delete({ where: { tokenHash } });
    const { accessToken, refreshToken: newRefresh } = await issueTokenPair(
      stored.userId,
      stored.user.role
    );

    res.json({ token: accessToken, refreshToken: newRefresh, user: sanitizeUser(stored.user) });
  } catch (err) {
    next(err);
  }
}

// ── Logout – revoke refresh token ─────────────────────────────────────────────
export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {});
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "USER_LOGOUT",
          entityType: "User",
          entityId: String(req.user.id),
        },
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

// ── Me ────────────────────────────────────────────────────────────────────────
export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { operator: true },
    });
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

// ── Update profile ────────────────────────────────────────────────────────────
export async function updateProfile(req, res, next) {
  try {
    const name           = String(req.body?.name || "").trim();
    const phone          = String(req.body?.phone || "").trim();
    const profileImageUrl = req.body?.profileImageUrl || "";

    if (!name) return res.status(400).json({ message: "Name is required" });

    if (!isValidProfileImage(profileImageUrl)) {
      return res.status(400).json({ message: "Invalid profile image format" });
    }

    if (profileImageUrl && profileImageUrl.length > 1_500_000) {
      return res.status(400).json({ message: "Profile image is too large. Please upload an image below 1MB." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        phone: phone || null,
        profileImageUrl: profileImageUrl || null,
      },
      include: { operator: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: String(req.user.id),
        details: {
          nameUpdated: true,
          phoneUpdated: Boolean(phone),
          profileImageUpdated: Boolean(profileImageUrl),
        },
      },
    });

    res.json({ message: "Profile updated successfully", user: sanitizeUser(updatedUser) });
  } catch (err) {
    next(err);
  }
}

// ── Change password ────────────────────────────────────────────────────────────
export async function changePassword(req, res, next) {
  try {
    // Input validated by Zod (changePasswordSchema) – newPassword != confirmPassword check there
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens on password change (force re-login everywhere)
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: String(req.user.id),
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

// ── Notification preferences ───────────────────────────────────────────────────
export async function updateNotificationPreferences(req, res, next) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        notifyBookingUpdates:    Boolean(req.body?.notifyBookingUpdates),
        notifyPaymentReminders:  Boolean(req.body?.notifyPaymentReminders),
        notifyInvoices:          Boolean(req.body?.notifyInvoices),
        notifyPromotions:        Boolean(req.body?.notifyPromotions),
      },
      include: { operator: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "NOTIFICATION_PREFERENCES_UPDATED",
        entityType: "User",
        entityId: String(req.user.id),
        details: {
          notifyBookingUpdates:   updatedUser.notifyBookingUpdates,
          notifyPaymentReminders: updatedUser.notifyPaymentReminders,
          notifyInvoices:         updatedUser.notifyInvoices,
          notifyPromotions:       updatedUser.notifyPromotions,
        },
      },
    });

    res.json({ message: "Notification preferences updated", user: sanitizeUser(updatedUser) });
  } catch (err) {
    next(err);
  }
}

// ── GDPR – Right to Erasure (Art. 17 GDPR) ────────────────────────────────────
// Anonymises personal data while preserving audit trail integrity.
export async function deleteAccount(req, res, next) {
  try {
    const userId = req.user.id;

    // Verify password before destruction (prevents accidental deletion)
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Password is required to delete your account" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Anonymise personal data – keep structural records for PCI DSS audit trail
    await prisma.user.update({
      where: { id: userId },
      data: {
        name:           `[DELETED_${userId}]`,
        email:          `deleted_${userId}@removed.invalid`,
        password:       await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        phone:          null,
        profileImageUrl: null,
      },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    // Unsubscribe from all notifications
    await prisma.notification.deleteMany({ where: { userId } });

    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "ACCOUNT_DELETED_GDPR",
        entityType: "User",
        entityId: String(userId),
        details: { requestedBy: userId, reason: "GDPR Right to Erasure" },
      },
    });

    res.json({ message: "Your account has been deleted. Personal data has been removed." });
  } catch (err) {
    next(err);
  }
}
