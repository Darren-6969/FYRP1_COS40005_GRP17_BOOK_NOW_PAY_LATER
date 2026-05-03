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
      id: "desc",
    },
    select: {
      userCode: true,
      id: true,
    },
  });

  let nextNumber = 1;

  if (latestUser?.userCode) {
    const numericPart = latestUser.userCode.replace(prefix, "");
    const parsed = Number(numericPart);

    if (Number.isInteger(parsed) && parsed > 0) {
      nextNumber = parsed + 1;
    } else {
      nextNumber = latestUser.id + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
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
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
    } catch (err) {
      lastError = err;

      // P2002 = unique constraint failed.
      // Retry only if the conflict is probably userCode.
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

    res.status(201).json(user);
  } catch (err) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : String(err.meta?.target || "unique field");

      return res.status(409).json({
        message: `Duplicate value detected for ${target}. Please try again.`,
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
      user: {
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        email: user.email,
        role: user.role,
        operator: user.operator,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({
    id: req.user.id,
    userCode: req.user.userCode,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    operator: req.user.operator,
  });
}