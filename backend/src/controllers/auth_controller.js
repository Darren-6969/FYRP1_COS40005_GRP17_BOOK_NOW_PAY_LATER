import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

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
    where: {
      role,
      userCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      userCode: "desc",
    },
    select: {
      userCode: true,
    },
  });

  let nextNumber = 1;

  if (latestUser?.userCode) {
    const numericPart = latestUser.userCode.replace(prefix, "");
    const parsed = Number(numericPart);

    if (Number.isInteger(parsed) && parsed > 0) {
      nextNumber = parsed + 1;
    }
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

  const isDataImage = value.startsWith("data:image/");
  const isHttpUrl = value.startsWith("http://") || value.startsWith("https://");

  return isDataImage || isHttpUrl;
}

async function createCustomerWithRetry({ name, email, password }) {
  const safeRole = "CUSTOMER";
  const hashedPassword = await bcrypt.hash(password, 10);

  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const userCode = await generateUserCode(safeRole);

      return await prisma.user.create({
        data: {
          userCode,
          name,
          email,
          password: hashedPassword,
          role: safeRole,
        },
      });
    } catch (err) {
      lastError = err;

      if (err.code !== "P2002") {
        throw err;
      }

      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(",")
        : String(err.meta?.target || "");

      if (!target.includes("userCode")) {
        throw err;
      }
    }
  }

  throw lastError;
}

export async function register(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const existing = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existing) {
      return res.status(409).json({
        message: "Email already exists. Please login instead.",
      });
    }

    const user = await createCustomerWithRetry({
      name,
      email,
      password,
    });

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
      return res.status(409).json({
        message: "Duplicate value detected. Please try again.",
        target: err.meta?.target,
      });
    }

    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication is not configured",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        operator: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: String(user.id),
      },
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        operator: true,
      },
    });

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const profileImageUrl = req.body?.profileImageUrl || "";

    if (!name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    if (!isValidProfileImage(profileImageUrl)) {
      return res.status(400).json({
        message: "Invalid profile image format",
      });
    }

    if (profileImageUrl && profileImageUrl.length > 1_500_000) {
      return res.status(400).json({
        message: "Profile image is too large. Please upload an image below 1MB.",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        name,
        phone: phone || null,
        profileImageUrl: profileImageUrl || null,
      },
      include: {
        operator: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: String(req.user.id),
        details: {
          nameUpdated: true,
          phoneUpdated: true,
          profileImageUpdated: Boolean(profileImageUrl),
        },
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Current password, new password and confirm password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    const valid = await bcrypt.compare(currentPassword, user.password);

    if (!valid) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: String(req.user.id),
      },
    });

    res.json({
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        notifyBookingUpdates: Boolean(req.body?.notifyBookingUpdates),
        notifyPaymentReminders: Boolean(req.body?.notifyPaymentReminders),
        notifyInvoices: Boolean(req.body?.notifyInvoices),
        notifyPromotions: Boolean(req.body?.notifyPromotions),
      },
      include: {
        operator: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "NOTIFICATION_PREFERENCES_UPDATED",
        entityType: "User",
        entityId: String(req.user.id),
        details: {
          notifyBookingUpdates: updatedUser.notifyBookingUpdates,
          notifyPaymentReminders: updatedUser.notifyPaymentReminders,
          notifyInvoices: updatedUser.notifyInvoices,
          notifyPromotions: updatedUser.notifyPromotions,
        },
      },
    });

    res.json({
      message: "Notification preferences updated",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    next(err);
  }
}