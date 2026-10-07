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

      include: {
        pickupPoints: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              id: "asc",
            },
          ],
        },
      },

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
// POST /api/operators/branches/:branchId/points
export async function createBranchPoint(
  req,
  res,
  next
) {
  try {
    const branchId = parseId(
      req.params.branchId,
      "branch id"
    );

    const branch =
      await prisma.branch.findFirst({
        where: {
          id: branchId,
          ...branchWhere(req),
        },
      });

    if (!branch) {
      return res.status(404).json({
        message: "Branch not found",
      });
    }

    const {
      label,
      address,
      note,
      usage,
      pickupFee,
      dropoffFee,
    } = req.body;

    if (
      !label ||
      !String(label).trim()
    ) {
      return res.status(400).json({
        message:
          "Point name is required.",
      });
    }

    const validUsage = [
      "PICKUP",
      "DROPOFF",
      "BOTH",
    ];

    const pointUsage =
      String(
        usage || "BOTH"
      ).toUpperCase();

    if (
      !validUsage.includes(
        pointUsage
      )
    ) {
      return res.status(400).json({
        message:
          "Usage must be PICKUP, DROPOFF or BOTH.",
      });
    }

    const pickupCharge =
      Number(pickupFee || 0);

    const dropoffCharge =
      Number(dropoffFee || 0);

    if (
      !Number.isFinite(
        pickupCharge
      ) ||
      pickupCharge < 0
    ) {
      return res.status(400).json({
        message:
          "Pickup charge must be 0 or more.",
      });
    }

    if (
      !Number.isFinite(
        dropoffCharge
      ) ||
      dropoffCharge < 0
    ) {
      return res.status(400).json({
        message:
          "Drop-off charge must be 0 or more.",
      });
    }

    const lastPoint =
      await prisma.pickupPoint.findFirst({
        where: {
          branchId,
        },
        orderBy: {
          sortOrder: "desc",
        },
      });

    const point =
      await prisma.pickupPoint.create({
        data: {
          branchId,

          label:
            String(label).trim(),

          address:
            address
              ? String(
                  address
                ).trim()
              : null,

          note:
            note
              ? String(note).trim()
              : null,

          usage:
            pointUsage,

          fee:
            pointUsage ===
            "DROPOFF"
              ? 0
              : pickupCharge,

          dropoffFee:
            pointUsage ===
            "PICKUP"
              ? 0
              : dropoffCharge,

          isActive:
            true,

          sortOrder:
            (lastPoint?.sortOrder ??
              -1) + 1,
        },
      });

    res.status(201).json({
      message:
        "Pickup/drop-off point created successfully",
      point,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/operators/branches/:branchId/points/:pointId
export async function updateBranchPoint(
  req,
  res,
  next
) {
  try {
    const branchId = parseId(
      req.params.branchId,
      "branch id"
    );

    const pointId = parseId(
      req.params.pointId,
      "point id"
    );

    const branch =
      await prisma.branch.findFirst({
        where: {
          id: branchId,
          ...branchWhere(req),
        },
      });

    if (!branch) {
      return res.status(404).json({
        message: "Branch not found",
      });
    }

    const existingPoint =
      await prisma.pickupPoint.findFirst({
        where: {
          id: pointId,
          branchId,
        },
      });

    if (!existingPoint) {
      return res.status(404).json({
        message:
          "Pickup/drop-off point not found",
      });
    }

    const {
      label,
      address,
      note,
      usage,
      pickupFee,
      dropoffFee,
      isActive,
    } = req.body;

    const data = {};

    if (label !== undefined) {
      const value =
        String(label).trim();

      if (!value) {
        return res
          .status(400)
          .json({
            message:
              "Point name is required.",
          });
      }

      data.label = value;
    }

    if (address !== undefined) {
      data.address = address
        ? String(address).trim()
        : null;
    }

    if (note !== undefined) {
      data.note = note
        ? String(note).trim()
        : null;
    }

    let pointUsage =
      usage !== undefined
        ? String(
            usage
          ).toUpperCase()
        : existingPoint.usage;

    if (
      ![
        "PICKUP",
        "DROPOFF",
        "BOTH",
      ].includes(pointUsage)
    ) {
      return res.status(400).json({
        message:
          "Usage must be PICKUP, DROPOFF or BOTH.",
      });
    }

    if (usage !== undefined) {
      data.usage =
        pointUsage;
    }

    if (
      pickupFee !== undefined
    ) {
      const value =
        Number(pickupFee);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Pickup charge must be 0 or more.",
          });
      }

      data.fee = value;
    }

    if (
      dropoffFee !== undefined
    ) {
      const value =
        Number(dropoffFee);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Drop-off charge must be 0 or more.",
          });
      }

      data.dropoffFee =
        value;
    }

    // Keep irrelevant charges at zero.
    if (
      pointUsage === "PICKUP"
    ) {
      data.dropoffFee = 0;
    }

    if (
      pointUsage === "DROPOFF"
    ) {
      data.fee = 0;
    }

    if (
      isActive !== undefined
    ) {
      data.isActive =
        Boolean(isActive);
    }

    const point =
      await prisma.pickupPoint.update({
        where: {
          id: pointId,
        },
        data,
      });

    res.json({
      message:
        "Pickup/drop-off point updated successfully",
      point,
    });
  } catch (err) {
    next(err);
  }
}