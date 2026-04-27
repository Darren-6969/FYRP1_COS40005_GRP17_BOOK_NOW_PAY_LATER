import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

async function generateUserCode(role) {
  const prefixMap = {
    CUSTOMER: "CUS",
    NORMAL_SELLER: "OPR",
    MASTER_SELLER: "ADN",
  };

  const prefix = prefixMap[role] || "USR";

  const count = await prisma.user.count({
    where: {
      role,
    },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function generateOperatorCode() {
  const count = await prisma.operator.count();
  return `OPR${String(count + 1).padStart(4, "0")}`;
}

export async function register(req, res, next) {
  try {
    const { name, email, password, role = "CUSTOMER" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const allowedRoles = ["CUSTOMER", "MASTER_SELLER", "NORMAL_SELLER"];
    const safeRole = allowedRoles.includes(role) ? role : "CUSTOMER";

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = await generateUserCode(safeRole);

    const user = await prisma.user.create({
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

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: user.id,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { operator: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: user.id,
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