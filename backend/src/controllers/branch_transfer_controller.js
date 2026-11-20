
import prisma from "../config/db.js";
import { klToday } from "../services/car_pricing_service.js";
import {
  assertListingQuantitySafe,
} from "../services/listing_stock_service.js";

function fail(statusCode, message) {
  return Object.assign(new Error(message), {
    statusCode,
  });
}

function getOperatorScope(req, requestedOperatorId) {
  if (req.user.role === "MASTER_SELLER") {
    const id = Number(requestedOperatorId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw fail(400, "A valid operatorId is required.");
    }
    return id;
  }

  if (!req.user.operatorId) {
    throw fail(403, "No operator linked to this account.");
  }

  return Number(req.user.operatorId);
}

function sameVehicle(a, b) {
  const fields = [
    "vehicleMake",
    "vehicleModel",
    "vehicleType",
    "modelYear",
    "transmission",
    "powertrain",
    "drivetrain",
    "seats",
  ];

  return fields.every(
    (field) => a[field] === b[field]
  );
}

/**
 * POST /api/operators/branches/transfers
 *
 * Immediate quantity transfer between existing
 * matching vehicle listings of the same operator.
 */
export async function transferBranchStock(req, res, next) {
  try {
    const {
      sourceListingId,
      destinationListingId,
      quantity,
      reason,
      operatorId,
    } = req.body ?? {};

    const sourceId = Number(sourceListingId);
    const destinationId = Number(destinationListingId);
    const amount = Number(quantity);
    const cleanReason =
      typeof reason === "string" ? reason.trim() : "";

    if (
      !Number.isSafeInteger(sourceId) ||
      sourceId <= 0 ||
      !Number.isSafeInteger(destinationId) ||
      destinationId <= 0 ||
      sourceId === destinationId
    ) {
      return res.status(400).json({
        message: "Select two different valid listings.",
      });
    }

    if (
      quantity == null ||
      typeof quantity === "boolean" ||
      !Number.isSafeInteger(amount) ||
      amount < 1
    ) {
      return res.status(400).json({
        message: "Transfer quantity must be at least 1.",
      });
    }

    if (
      cleanReason.length < 5 ||
      cleanReason.length > 300
    ) {
      return res.status(400).json({
        message:
          "Transfer reason must be between 5 and 300 characters.",
      });
    }

    const scopedOperatorId = getOperatorScope(
      req,
      operatorId
    );

    const result = await prisma.$transaction(
      async (tx) => {
        // Always acquire locks in ascending ID order
        // to reduce deadlock risk.
        const lockIds = [
          sourceId,
          destinationId,
        ].sort((a, b) => a - b);

        for (const id of lockIds) {
          await tx.$queryRaw`
            SELECT id FROM "Listing"
            WHERE id = ${id}
            FOR UPDATE
          `;
        }

        const listings = await tx.listing.findMany({
          where: {
            id: { in: lockIds },
            operatorId: scopedOperatorId,
            category: "CAR_RENTAL",
          },
          include: {
            branch: true,
          },
        });

        const source = listings.find(
          (item) => item.id === sourceId
        );

        const destination = listings.find(
          (item) => item.id === destinationId
        );

        if (!source || !destination) {
          throw fail(
            404,
            "Source or destination listing not found."
          );
        }

        if (
          source.branchId === destination.branchId
        ) {
          throw fail(
            400,
            "Select listings from different branches."
          );
        }

        if (
          !source.branch?.isActive ||
          !destination.branch?.isActive
        ) {
          throw fail(
            409,
            "Both branches must be active."
          );
        }

        if (
          !sameVehicle(source, destination)
        ) {
          throw fail(
            409,
            "Vehicles must have matching specifications."
          );
        }

        const oldSourceQuantity =
          Number(source.quantity);

        const oldDestinationQuantity =
          Number(destination.quantity);

        if (amount > oldSourceQuantity) {
          throw fail(
            409,
            `Source only has ${oldSourceQuantity} vehicle(s).`
          );
        }

        const newSourceQuantity =
          oldSourceQuantity - amount;

        const newDestinationQuantity =
          oldDestinationQuantity + amount;

        if (
          !Number.isSafeInteger(newDestinationQuantity)
        ) {
          throw fail(400, "Destination quantity is too large.");
        }

        // Prevent a transfer from silently changing
        // the meaning of explicit daily overrides.
        const overriddenDates =
          await tx.listingAllocation.findMany({
            where: {
              listingId: {
                in: [sourceId, destinationId],
              },
              date: {
                gte: new Date(
                  `${klToday()}T00:00:00.000Z`
                ),
              },
              quantity: {
                not: null,
              },
            },
            select: {
              listingId: true,
              date: true,
            },
            take: 1,
          });

        if (overriddenDates.length) {
          throw fail(
            409,
            "A listing has future Daily Stock overrides. " +
            "Review and reset those overrides before transferring stock."
          );
        }

        // Conservative protection: a car that is
        // currently on rental should not be moved.
        const ongoingRentals = await tx.booking.count({
          where: {
            listingId: sourceId,
            status: "IN_PROGRESS",
          },
        });

        if (ongoingRentals > 0) {
          throw fail(
            409,
            "Source has vehicles currently on rental. " +
            "Complete the returns before transferring stock."
          );
        }

        // Enforce active booking and servicing
        // requirements across the source calendar.
        await assertListingQuantitySafe(
          tx,
          sourceId,
          newSourceQuantity
        );

        // Atomically update both listings.
        await tx.listing.update({
          where: { id: sourceId },
          data: {
            quantity: newSourceQuantity,
          },
        });

        await tx.listing.update({
          where: { id: destinationId },
          data: {
            quantity: newDestinationQuantity,
          },
        });

        const transfer = {
          operatorId: scopedOperatorId,
          sourceListingId: sourceId,
          destinationListingId: destinationId,
          sourceBranchId: source.branchId,
          destinationBranchId: destination.branchId,
          sourceBranchName: source.branch.name,
          destinationBranchName: destination.branch.name,
          vehicleName: source.name,
          quantity: amount,
          beforeSourceQuantity: oldSourceQuantity,
          afterSourceQuantity: newSourceQuantity,
          beforeDestinationQuantity:
            oldDestinationQuantity,
          afterDestinationQuantity:
            newDestinationQuantity,
          reason: cleanReason,
          transferredById: req.user.id,
          transferredAt: new Date().toISOString(),
        };

        // Existing AuditLog provides persistent
        // transfer history without a schema change.
        const audit = await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "BRANCH_STOCK_TRANSFERRED",
            entityType: "Listing",
            entityId: String(sourceId),
            details: transfer,
          },
        });

        return {
          id: audit.id,
          ...transfer,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return res.status(201).json({
      message: "Branch stock transfer completed.",
      transfer: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/operators/branches/transfers
 * Shows recent transfers for the selected company.
 */
export async function getBranchTransfers(req, res, next) {
  try {
    const operatorId = getOperatorScope(
      req,
      req.query.operatorId
    );

    const listings = await prisma.listing.findMany({
      where: { operatorId },
      select: { id: true },
    });

    const ids = listings.map(
      (listing) => String(listing.id)
    );

    if (!ids.length) {
      return res.json({ transfers: [] });
    }

    const records = await prisma.auditLog.findMany({
      where: {
        action: "BRANCH_STOCK_TRANSFERRED",
        entityType: "Listing",
        entityId: { in: ids },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return res.json({
      transfers: records.map((record) => ({
        id: record.id,
        ...record.details,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}
