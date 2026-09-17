import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";

function branchWhere(req) {
  if (req.user.role === "MASTER_SELLER") {
    return {};
  }

  return {
    operatorId: req.user.operatorId,
  };
}

// GET /api/operators/branches
export async function getBranches(req, res, next) {
  try {
    const branches = await prisma.branch.findMany({
      where: branchWhere(req),
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      branches,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/operators/branches
export async function createBranch(req, res, next) {
  try {
    const {
      name,
      address,
      city,
      state,
      country,
      phone,
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        message: "Branch name and address are required.",
      });
    }

    if (!req.user.operatorId) {
      return res.status(400).json({
        message: "No operator is linked to this account.",
      });
    }

    const branch = await prisma.branch.create({
      data: {
        operatorId: req.user.operatorId,
        name: String(name).trim(),
        address: String(address).trim(),
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        country: country
          ? String(country).trim()
          : "Malaysia",
        phone: phone ? String(phone).trim() : null,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Branch created successfully",
      branch,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/operators/branches/:id
export async function updateBranch(req, res, next) {
  try {
    const id = parseId(
      req.params.id,
      "branch id"
    );

    const existingBranch =
      await prisma.branch.findFirst({
        where: {
          id,
          ...branchWhere(req),
        },
      });

    if (!existingBranch) {
      return res.status(404).json({
        message: "Branch not found",
      });
    }

    const {
      name,
      address,
      city,
      state,
      country,
      phone,
      isActive,
    } = req.body;

    const data = {};

    if (name !== undefined) {
      data.name = String(name).trim();
    }

    if (address !== undefined) {
      data.address = String(address).trim();
    }

    if (city !== undefined) {
      data.city = city
        ? String(city).trim()
        : null;
    }

    if (state !== undefined) {
      data.state = state
        ? String(state).trim()
        : null;
    }

    if (country !== undefined) {
      data.country = country
        ? String(country).trim()
        : "Malaysia";
    }

    if (phone !== undefined) {
      data.phone = phone
        ? String(phone).trim()
        : null;
    }

    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    const branch = await prisma.branch.update({
      where: {
        id,
      },
      data,
    });

    res.json({
      message: "Branch updated successfully",
      branch,
    });
  } catch (err) {
    next(err);
  }
}