import prisma from "../config/db.js";
import { writeImageOrder } from "../services/listing_image_order_service.js";
import { deletePublicFile } from "../services/media_storage.js";
import { parseId } from "../utils/parseId.js";

import {
  validateRateCard,
} from "../services/listing_rates.js";

import {
  getListingLimit,
} from "../services/subscription_service.js";

import { getPlatformSettings } from "../services/platform_settings_service.js";
import { assertSubscriptionActive } from "../services/subscription_admin_service.js";
import {
  assertListingQuantitySafe,
} from "../services/listing_stock_service.js";
import {
  reservedStockByDate,
} from "../services/listing_stock_service.js";

function isPlainDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

function addPlainDateDays(
  plainDate,
  days
) {
  const [year, month, day] =
    plainDate.split("-").map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function validStockDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function stockDateRange(fromDate, toDate) {
  if (
    !validStockDate(fromDate) ||
    !validStockDate(toDate) ||
    toDate < fromDate
  ) {
    const error = new Error(
      "Invalid servicing date range."
    );
    error.statusCode = 400;
    throw error;
  }

  const dates = [];

  for (
    let date = fromDate;
    date <= toDate;
    date = addPlainDateDays(date, 1)
  ) {
    dates.push(date);

    if (dates.length > 90) {
      const error = new Error(
        "Servicing date range cannot exceed 90 days."
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return dates;
}

function listingWhere(req) {
  if (req.user.role === "MASTER_SELLER") {
    return {};
  }

  return {
    operatorId: req.user.operatorId,
  };
}

function includeListingRelations() {
  return {
    operator: {
      select: { id: true, companyName: true, operatorCode: true },
    },
    branch: true,
    images: {
      orderBy: {
        sortOrder: "asc",
      },
    },
  };
}

function mapListing(listing) {
  if (!listing) return null;

  return {
    ...listing,

    price:
      listing.price == null
        ? 0
        : Number(listing.price),

    hourlyRate:
      listing.hourlyRate == null
        ? null
        : Number(listing.hourlyRate),

    weeklyRate:
      listing.weeklyRate == null
        ? null
        : Number(listing.weeklyRate),

    monthlyRate:
      listing.monthlyRate == null
        ? null
        : Number(listing.monthlyRate),

    cdwDailyPrice:
      listing.cdwDailyPrice == null
        ? null
        : Number(listing.cdwDailyPrice),
  };
}

// ==========================================================
// GET ALL LISTINGS
// ==========================================================

export async function getListings(req, res, next) {
  try {
    const {
      status,
      category,
      q,
    } = req.query;

    const where = {
      ...listingWhere(req),
    };

    if (
      status &&
      status !== "ALL"
    ) {
      where.status = status;
    }

    if (
      category &&
      category !== "ALL"
    ) {
      where.category = category;
    }

    if (q) {
      where.OR = [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          vehicleMake: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          vehicleModel: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          branch: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const listings =
    await prisma.listing.findMany({
      where,

      include:
        includeListingRelations(),

      orderBy: {
        createdAt: "desc",
      },
    });

  let subscription = null;

  if (
    req.user.role ===
      "NORMAL_SELLER" &&
    req.user.operatorId
  ) {
    const operator =
      await prisma.operator.findUnique({
        where: {
          id:
            req.user.operatorId,
        },

        select: {
          subscriptionPlan:
            true,
        },
      });

    if (operator) {
      const listingLimit =
        getListingLimit(operator.subscriptionPlan, (await getPlatformSettings()).subscriptionTiers);

      const publishedCount =
        await prisma.listing.count({
          where: {
            operatorId:
              req.user.operatorId,

            status:
              "PUBLISHED",
          },
        });

      subscription = {
        plan:
          operator.subscriptionPlan,

        listingLimit,

        publishedCount,

        remaining:
          Math.max(
            0,
            listingLimit -
              publishedCount
          ),
      };
    }
  }

  res.json({
    listings:
      listings.map(
        mapListing
      ),

    subscription,
  });
  } catch (err) {
    next(err);
  }
}

export async function getListingAllocations(
  req,
  res,
  next
) {
  try {
    const listingId =
      parseId(
        req.params.id,
        "listing id"
      );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found.",
      });
    }

    const {
      from,
      to,
    } = req.query;

    const where = {
      listingId,
    };

    if (
      from &&
      to &&
      isPlainDate(from) &&
      isPlainDate(to)
    ) {
      where.date = {
        gte:
          new Date(
            `${from}T00:00:00.000Z`
          ),

        lt:
          new Date(
            `${addPlainDateDays(
              to,
              1
            )}T00:00:00.000Z`
          ),
      };
    }

    const allocations =
      await prisma.listingAllocation.findMany({
        where,

        orderBy: {
          date: "asc",
        },
      });

    res.json({
      allocations:
        allocations.map(
          (item) => ({
            ...item,

            date:
              item.date
                .toISOString()
                .slice(0, 10),
          })
        ),
    });
  } catch (err) {
    next(err);
  }
}


/**
 * Requirement 8.2.5
 * Update the available fleet capacity for selected dates.
 *
 * PATCH /api/operators/listings/:id/daily-allocation
 *
 * Body:
 * {
 *   fromDate: "2026-11-25",
 *   toDate: "2026-11-27",
 *   quantity: 3
 * }
 *
 * Set quantity to null to remove daily overrides
 * and restore the listing's default fleet quantity.
 */
export async function updateDailyStockAllocation(
  req,
  res,
  next
) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const {
      fromDate,
      toDate,
      quantity,
    } = req.body ?? {};

    const validDate = (value) => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const parsed = new Date(
        `${value}T00:00:00.000Z`
      );

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    };

    if (
      !validDate(fromDate) ||
      !validDate(toDate) ||
      toDate < fromDate
    ) {
      return res.status(400).json({
        message: "Invalid allocation date range.",
      });
    }

    // This endpoint manages the upcoming
    // 90-day inventory calendar.
    const today = new Date(
      Date.now() + 8 * 60 * 60 * 1000
    ).toISOString().slice(0, 10);

    const maxDate = new Date(
      `${today}T00:00:00.000Z`
    );

    maxDate.setUTCDate(
      maxDate.getUTCDate() + 89
    );

    const lastAllowedDate =
      maxDate.toISOString().slice(0, 10);

    if (
      fromDate < today ||
      toDate > lastAllowedDate
    ) {
      return res.status(400).json({
        message:
          "Daily stock adjustments must be within the upcoming 90 days.",
      });
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        req.body ?? {},
        "quantity"
      )
    ) {
      return res.status(400).json({
        message:
          "Quantity is required. Use null to reset the daily override.",
      });
    }

    const resetToDefault = quantity === null;

    const nextQuantity = resetToDefault
      ? null
      : Number(quantity);

    if (
      !resetToDefault &&
      (
        quantity === "" ||
        typeof quantity === "boolean" ||
        !Number.isSafeInteger(nextQuantity) ||
        nextQuantity < 0
      )
    ) {
      return res.status(400).json({
        message:
          "Quantity must be a non-negative whole number, or null to reset.",
      });
    }

    const dates = [];

    for (
      let date = fromDate;
      date <= toDate;
      date = addPlainDateDays(date, 1)
    ) {
      dates.push(date);

      if (dates.length > 90) {
        return res.status(400).json({
          message:
            "Allocation range cannot exceed 90 days.",
        });
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Booking creation locks the same Listing
        // row, preventing simultaneous allocation
        // changes and booking reservations.
        await tx.$queryRaw`
          SELECT id FROM "Listing"
          WHERE id = ${listingId}
          FOR UPDATE
        `;

        const listing = await tx.listing.findFirst({
          where: {
            id: listingId,
            ...listingWhere(req),
          },
          select: {
            id: true,
            name: true,
            category: true,
            quantity: true,
          },
        });

        if (!listing) {
          const error = new Error(
            "Listing not found."
          );
          error.statusCode = 404;
          throw error;
        }

        if (listing.category !== "CAR_RENTAL") {
          const error = new Error(
            "Daily vehicle stock applies only to car rental listings."
          );
          error.statusCode = 400;
          throw error;
        }

        const defaultQuantity =
          Number(listing.quantity);

        if (
          !resetToDefault &&
          nextQuantity > defaultQuantity
        ) {
          const error = new Error(
            `Daily allocation cannot exceed the fleet total of ${defaultQuantity}. ` +
            "Increase the listing quantity first."
          );
          error.statusCode = 409;
          throw error;
        }

        // Current reservations for each date.
        const reserved = await reservedStockByDate(
          tx,
          listingId,
          fromDate,
          toDate
        );

        // Existing daily overrides / servicing blocks.
        const allocations =
          await tx.listingAllocation.findMany({
            where: {
              listingId,
              date: {
                gte: new Date(
                  `${fromDate}T00:00:00.000Z`
                ),
                lte: new Date(
                  `${toDate}T00:00:00.000Z`
                ),
              },
            },
          });

        const allocationMap = new Map(
          allocations.map((allocation) => [
            allocation.date
              .toISOString()
              .slice(0, 10),
            allocation,
          ])
        );

        // Validate all selected dates before
        // any database changes are applied.
        for (const date of dates) {
          const allocation =
            allocationMap.get(date);

          const effectiveCapacity =
            resetToDefault
              ? defaultQuantity
              : nextQuantity;

          const reservedCount =
            reserved.get(date) ?? 0;

          const blockedCount = Number(
            allocation?.blockedQuantity ?? 0
          );

          // A fully blocked day cannot hold
          // an active booking safely.
          const availableCapacity =
            allocation?.isBlocked &&
            blockedCount === 0
              ? 0
              : effectiveCapacity - blockedCount;

          if (
            blockedCount > effectiveCapacity ||
            reservedCount > availableCapacity
          ) {
            const error = new Error(
              `Cannot set daily stock on ${date}. ` +
              `${reservedCount} vehicle(s) reserved, ` +
              `${blockedCount} vehicle(s) blocked. ` +
              `Requested capacity: ${effectiveCapacity}.`
            );

            error.statusCode = 409;
            throw error;
          }
        }

        // Update each allocation.
        // Preserve servicing quantities and notes.
        for (const date of dates) {
          const dateValue = new Date(
            `${date}T00:00:00.000Z`
          );

          await tx.listingAllocation.upsert({
            where: {
              listingId_date: {
                listingId,
                date: dateValue,
              },
            },
            create: {
              listingId,
              date: dateValue,
              quantity: nextQuantity,
              blockedQuantity: 0,
              isBlocked: false,
            },
            
            update: {
              quantity: nextQuantity,

              // Recalculate full-block status if this
              // allocation contains servicing vehicles.
              // Preserve independent full-day blocks
              // when there is no servicing quantity.
              isBlocked:
                Number(
                  allocationMap.get(date)?.blockedQuantity ?? 0
                ) > 0
                  ? Number(
                      allocationMap.get(date).blockedQuantity
                    ) >= (resetToDefault
                      ? defaultQuantity
                      : nextQuantity)
                  : allocationMap.get(date)?.isBlocked ?? false,
            },

          });
        }

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action:
              "LISTING_DAILY_STOCK_UPDATED",
            entityType: "Listing",
            entityId: String(listingId),
            details: {
              fromDate,
              toDate,
              quantity: nextQuantity,
              resetToDefault,
              affectedDays: dates.length,
            },
          },
        });

        return {
          listingId,
          listingName: listing.name,
          defaultQuantity,
          dailyQuantity: nextQuantity,
          resetToDefault,
          fromDate,
          toDate,
          updatedDates: dates,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return res.json({
      message: resetToDefault
        ? "Daily allocation reset to default."
        : "Daily stock allocation updated.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function blockListingForServicing(
  req,
  res,
  next
) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const {
      fromDate,
      toDate,
      blockedQuantity,
      note,
    } = req.body ?? {};

    const dates = stockDateRange(
      fromDate,
      toDate
    );

    const servicingQuantity = Number(
      blockedQuantity
    );

    if (
      blockedQuantity == null ||
      !Number.isSafeInteger(servicingQuantity) ||
      servicingQuantity < 1
    ) {
      return res.status(400).json({
        message:
          "Servicing quantity must be a positive whole number.",
      });
    }

    const cleanNote =
      String(note ?? "Scheduled servicing")
        .trim()
        .slice(0, 300) || "Scheduled servicing";

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock the listing to prevent stock conflicts
        // with simultaneous customer bookings.
        await tx.$queryRaw`
          SELECT id FROM "Listing"
          WHERE id = ${listingId}
          FOR UPDATE
        `;

        // Verify listing ownership.
        const listing = await tx.listing.findFirst({
          where: {
            id: listingId,
            ...listingWhere(req),
          },
          select: {
            id: true,
            name: true,
            quantity: true,
          },
        });

        if (!listing) {
          const error = new Error(
            "Listing not found."
          );
          error.statusCode = 404;
          throw error;
        }

        // Calculate existing reservations.
        const reserved = await reservedStockByDate(
          tx,
          listingId,
          fromDate,
          toDate
        );

        // Load existing daily stock allocations.
        const allocations =
          await tx.listingAllocation.findMany({
            where: {
              listingId,
              date: {
                gte: new Date(
                  `${fromDate}T00:00:00.000Z`
                ),
                lte: new Date(
                  `${toDate}T00:00:00.000Z`
                ),
              },
            },
          });

        const allocationMap = new Map(
          allocations.map((allocation) => [
            allocation.date
              .toISOString()
              .slice(0, 10),
            allocation,
          ])
        );

        const capacities = new Map();

        // Validate all dates before updating.
        for (const date of dates) {
          const allocation =
            allocationMap.get(date);

          const dailyCapacity = Number(
            allocation?.quantity ??
            listing.quantity
          );

          const reservedCount =
            reserved.get(date) ?? 0;

          if (
            servicingQuantity > dailyCapacity ||
            reservedCount + servicingQuantity >
              dailyCapacity
          ) {
            const error = new Error(
              `Cannot block ${servicingQuantity} ` +
              `vehicle(s) on ${date}. ` +
              `${reservedCount} already reserved, ` +
              `daily capacity ${dailyCapacity}.`
            );

            error.statusCode = 409;
            throw error;
          }

          capacities.set(
            date,
            dailyCapacity
          );
        }

        // Save allocations atomically.
        for (const date of dates) {
          const dateValue = new Date(
            `${date}T00:00:00.000Z`
          );

          const isBlocked =
            servicingQuantity >=
            capacities.get(date);

          await tx.listingAllocation.upsert({
            where: {
              listingId_date: {
                listingId,
                date: dateValue,
              },
            },

            create: {
              listingId,
              date: dateValue,
              quantity: null,
              blockedQuantity:
                servicingQuantity,
              isBlocked,
              note: cleanNote,
            },

            update: {
              blockedQuantity:
                servicingQuantity,
              isBlocked,
              note: cleanNote,
            },
          });
        }

        // Record audit history.
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action:
              "LISTING_SERVICING_BLOCK_UPDATED",
            entityType: "Listing",
            entityId: String(listingId),
            details: {
              fromDate,
              toDate,
              blockedQuantity:
                servicingQuantity,
              note: cleanNote,
            },
          },
        });

        return {
          listingId,
          totalQuantity: listing.quantity,
          blockedQuantity:
            servicingQuantity,
          fromDate,
          toDate,
          blockedDates: dates,
          note: cleanNote,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return res.json({
      message:
        "Servicing allocation saved successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}


export async function unblockListingServicing(
  req,
  res,
  next
) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const {
      fromDate,
      toDate,
    } = req.body ?? {};

    const dates = stockDateRange(
      fromDate,
      toDate
    );

    await prisma.$transaction(
      async (tx) => {
        // Prevent concurrent stock modifications.
        await tx.$queryRaw`
          SELECT id FROM "Listing"
          WHERE id = ${listingId}
          FOR UPDATE
        `;

        // Verify operator permission.
        const listing = await tx.listing.findFirst({
          where: {
            id: listingId,
            ...listingWhere(req),
          },
          select: {
            id: true,
          },
        });

        if (!listing) {
          const error = new Error(
            "Listing not found."
          );
          error.statusCode = 404;
          throw error;
        }

        // Remove servicing blocks while preserving
        // explicit daily stock quantity overrides.
        await tx.listingAllocation.updateMany({
          where: {
            listingId,
            date: {
              gte: new Date(
                `${fromDate}T00:00:00.000Z`
              ),
              lte: new Date(
                `${toDate}T00:00:00.000Z`
              ),
            },
          },
          data: {
            blockedQuantity: 0,
            isBlocked: false,
            note: null,
          },
        });

        // Save operator action history.
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action:
              "LISTING_SERVICING_BLOCK_REMOVED",
            entityType: "Listing",
            entityId: String(listingId),
            details: {
              fromDate,
              toDate,
            },
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return res.json({
      message:
        "Servicing block removed successfully.",
      listingId,
      unblockedDates: dates,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================================
// GET ONE LISTING
// ==========================================================

export async function getListingById(
  req,
  res,
  next
) {
  try {
    const id = parseId(
      req.params.id,
      "listing id"
    );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id,
          ...listingWhere(req),
        },

        include:
          includeListingRelations(),
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found",
      });
    }

    res.json({
      listing:
        mapListing(listing),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// CREATE LISTING
// ==========================================================

export async function createListing(
  req,
  res,
  next
) {
  try {
    const {
      branchId,
      category,
      name,
      description,

      // Pricing
      hourlyRate,
      price, // Daily rate
      weeklyRate,
      monthlyRate,
      cdwDailyPrice,

      quantity,

      vehicleMake,
      vehicleModel,
      vehicleType,
      modelYear,
      seats,
      transmission,
      luggageCapacity,

      pickupRules,
      returnRules,
      insuranceInfo,

      durationDays,
      highlights,
      itinerary,
      inclusions,
      exclusions,
      cancellationPolicy,
      meetingPoint,
      maxGroupSize,

      refundPolicy,
      termsAndConditions,

      carsxeImageUrl,
    } = req.body;

    if (
      !branchId ||
      !category ||
      !name ||
      price == null
    ) {
      return res.status(400).json({
        message:
          "Branch, category, name and price are required.",
      });
    }

    const dailyRate = Number(price);

    if (
      !Number.isFinite(dailyRate) ||
      dailyRate <= 0
    ) {
      return res.status(400).json({
        message:
          "Daily rate must be greater than 0.",
      });
    }

    const optionalRates = {
      hourlyRate,
      weeklyRate,
      monthlyRate,
      cdwDailyPrice,
    };

    for (const [field, value] of Object.entries(optionalRates)) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        const parsed = Number(value);

        if (
          !Number.isFinite(parsed) ||
          parsed < 0
        ) {
          return res.status(400).json({
            message:
              `${field} must be a valid positive amount.`,
          });
        }
      }
    }

    if (
      ![
        "CAR_RENTAL",
        "TOUR",
        // TEST-ITEM-MISC: delete this line to stop accepting the test item.
        "MISCELLANEOUS",
      ].includes(category)
    ) {
      return res.status(400).json({
        message:
          "Invalid listing category.",
      });
    }

    const rates =
      validateRateCard(req.body);

    if (!rates.ok) {
      return res.status(400).json({
        message:
          "Some rates are not valid.",
        errors:
          rates.errors,
      });
    }

    const branch =
      await prisma.branch.findFirst({
        where: {
          id: Number(branchId),
          ...listingWhere(req),
        },
      });

    if (!branch) {
      return res.status(404).json({
        message:
          "Branch not found.",
      });
    }

    if (
      category ===
      "CAR_RENTAL"
    ) {
      if (
        !vehicleMake ||
        !vehicleModel ||
        !vehicleType ||
        !transmission
      ) {
        return res.status(400).json({
          message:
            "Vehicle make, model and transmission are required for car rental listings.",
        });
      }
    }

    const listing =
      await prisma.listing.create({
        data: {
          operatorId:
            branch.operatorId,

          branchId:
            branch.id,

          category,

          status:
            "DRAFT",

          name,

          description:
            description || null,

          // =====================================================
          // Duration pricing
          // =====================================================

          hourlyRate:
            hourlyRate !== undefined &&
            hourlyRate !== null &&
            hourlyRate !== ""
              ? Number(hourlyRate)
              : null,

          ...rates.values,

          weeklyRate:
            weeklyRate !== undefined &&
            weeklyRate !== null &&
            weeklyRate !== ""
              ? Number(weeklyRate)
              : null,

          monthlyRate:
            monthlyRate !== undefined &&
            monthlyRate !== null &&
            monthlyRate !== ""
              ? Number(monthlyRate)
              : null,

          cdwDailyPrice:
            cdwDailyPrice !== undefined &&
            cdwDailyPrice !== null &&
            cdwDailyPrice !== ""
              ? Number(cdwDailyPrice)
              : null,

          quantity:
            Math.max(
              1,
              Number(quantity || 1)
            ),

          vehicleMake:
            vehicleMake || null,

          vehicleModel:
            vehicleModel || null,

          vehicleType:
            vehicleType || null,

          modelYear:
            modelYear
              ? Number(modelYear)
              : null,

          seats:
            seats
              ? Number(seats)
              : null,

          transmission:
            transmission || null,

          luggageCapacity:
            luggageCapacity
              ? Number(
                  luggageCapacity
                )
              : null,

          pickupRules:
            pickupRules || null,

          returnRules:
            returnRules || null,

          insuranceInfo:
            insuranceInfo || null,

          durationDays:
            durationDays
              ? Number(durationDays)
              : null,

          highlights:
            highlights || null,

          itinerary:
            itinerary || null,

          inclusions:
            inclusions || null,

          exclusions:
            exclusions || null,

          cancellationPolicy:
            cancellationPolicy ||
            null,

          meetingPoint:
            meetingPoint || null,

          maxGroupSize:
            maxGroupSize
              ? Number(maxGroupSize)
              : null,

          refundPolicy:
            refundPolicy || null,

          termsAndConditions:
            termsAndConditions ||
            null,

            ...(carsxeImageUrl
                    ? {
                        images: {
                            create: {
                            imageUrl:
                                carsxeImageUrl,

                            storageKey:
                                null,

                            sortOrder: 0,

                            isPrimary: true,
                            },
                        },
                        }
                    : {}),
        },

        include:
          includeListingRelations(),
      });

    res.status(201).json({
      message:
        "Listing created successfully",

      listing:
        mapListing(listing),
    });
  } catch (err) {
    next(err);
  }
}

 // =====================================================
 // Delete image controller
 // =====================================================

// Car photos and operator logos (admin Operators page, and the invoice logo in
// Operator Settings) are all stored under listing-images/.
const LISTING_IMAGE_KEY_PREFIX = "listing-images/";

// Remove a deleted photo's file once nothing points at it any more. The URL
// came from the operator when the photo was added, so it may be another
// operator's photo or a logo: while any listing photo, operator logo or
// invoice logo still uses it, the file stays. Runs after the delete has committed, so a failure
// here leaves an orphan file, never a photo row pointing at a missing file.
async function removeImageFileIfUnused(imageUrl) {
  if (!imageUrl) return;
  try {
    const uses = await Promise.all([
      prisma.listingImage.count({ where: { imageUrl } }),
      prisma.operator.count({ where: { logoUrl: imageUrl } }),
      prisma.bNPLConfig.count({ where: { invoiceLogoUrl: imageUrl } }),
    ]);
    if (uses.some((count) => count > 0)) return;
    await deletePublicFile(imageUrl, { onlyUnder: LISTING_IMAGE_KEY_PREFIX });
  } catch (err) {
    console.warn(JSON.stringify({ event: "listing_image_file_cleanup_failed", imageUrl, message: err?.message }));
  }
}

  export async function deleteListingImage(req, res, next) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const imageId = parseId(
      req.params.imageId,
      "image id"
    );

    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        ...listingWhere(req),
      },
      include: {
        images: true,
      },
    });

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found.",
      });
    }

    const image = listing.images.find(
      (item) => item.id === imageId
    );

    if (!image) {
      return res.status(404).json({
        message: "Listing image not found.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.listingImage.delete({
        where: {
          id: imageId,
        },
      });

      // Close the gap the deleted photo leaves; if it was the primary
      // photo, the next one becomes primary.
      await writeImageOrder(listingId, [], tx);
    });

    await removeImageFileIfUnused(image.imageUrl);

    const updatedListing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
        include:
          includeListingRelations(),
      });

    res.json({
      message:
        "Listing image removed successfully.",
      listing:
        mapListing(updatedListing),
    });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// Arrange image controller
// =====================================================
export async function setPrimaryListingImage(
  req,
  res,
  next
) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const imageId = parseId(
      req.params.imageId,
      "image id"
    );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
        include: {
          images: true,
        },
      });

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found.",
      });
    }

    const selectedImage =
      listing.images.find(
        (image) => image.id === imageId
      );

    if (!selectedImage) {
      return res.status(404).json({
        message:
          "Listing image not found.",
      });
    }

    // The chosen photo moves to the front; the others keep their order
    // behind it, so no two photos share a position.
    await prisma.$transaction((tx) =>
      writeImageOrder(listingId, [imageId], tx)
    );

    const updatedListing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
        include:
          includeListingRelations(),
      });

    return res.json({
      message:
        "Primary listing photo updated.",
      listing:
        mapListing(updatedListing),
    });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// Reorder image controller
// =====================================================
export async function reorderListingImages(
  req,
  res,
  next
) {
  try {
    const listingId = parseId(
      req.params.id,
      "listing id"
    );

    const { images } = req.body;

    if (!Array.isArray(images)) {
      return res.status(400).json({
        message:
          "Image order is required.",
      });
    }

    const listing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
        include: {
          images: true,
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found.",
      });
    }

    const existingIds =
      new Set(
        listing.images.map(
          (image) => image.id
        )
      );

    for (const item of images) {
      if (!existingIds.has(Number(item.id))) {
        return res.status(400).json({
          message:
            "Invalid listing image.",
        });
      }
    }

    // Photos missing from the request keep their order after the ones
    // sent, so a partial list cannot leave two photos at one position.
    await prisma.$transaction((tx) =>
      writeImageOrder(
        listingId,
        images.map((item) => item.id),
        tx
      )
    );

    const updatedListing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },
        include:
          includeListingRelations(),
      });

    return res.json({
      message:
        "Photo order updated successfully.",
      listing:
        mapListing(updatedListing),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// UPDATE LISTING
// ==========================================================

export async function updateListing(
  req,
  res,
  next
) {
  try {
    const id = parseId(
      req.params.id,
      "listing id"
    );

    const existing =
      await prisma.listing.findFirst({
        where: {
          id,
          ...listingWhere(req),
        },
      });

    if (!existing) {
      return res.status(404).json({
        message:
          "Listing not found",
      });
    }

    const data = {
      ...req.body,
    };

    const carsxeImageUrl =
    data.carsxeImageUrl;

    delete data.carsxeImageUrl;

    delete data.id;
    delete data.operatorId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.images;
    delete data.branch;

    const rates =
      validateRateCard(
        req.body,
        {
          partial: true,
        }
      );

    if (!rates.ok) {
      return res.status(400).json({
        message:
          "Some rates are not valid.",
        errors:
          rates.errors,
      });
    }

    Object.assign(
      data,
      rates.values
    );

    const optionalPriceFields = [
      "hourlyRate",
      "weeklyRate",
      "monthlyRate",
      "cdwDailyPrice",
    ];

    for (const field of optionalPriceFields) {
      if (data[field] !== undefined) {
        if (
          data[field] === "" ||
          data[field] === null
        ) {
          data[field] = null;
        } else {
          const parsed =
            Number(data[field]);

          if (
            !Number.isFinite(parsed) ||
            parsed < 0
          ) {
            return res.status(400).json({
              message:
                `${field} must be a valid positive amount.`,
            });
          }

          data[field] = parsed;
        }
      }
    }

    if (data.quantity !== undefined) {
    const parsedQuantity = Number(data.quantity);

    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 0
    ) {
      return res.status(400).json({
        message:
          "Quantity must be a non-negative whole number.",
      });
    }

    data.quantity = parsedQuantity;
  }

    if (
      data.modelYear !== undefined
    ) {
      data.modelYear =
        data.modelYear
          ? Number(
              data.modelYear
            )
          : null;
    }

    if (
      data.seats !== undefined
    ) {
      data.seats =
        data.seats
          ? Number(data.seats)
          : null;
    }

    if (
      data.luggageCapacity !==
      undefined
    ) {
      data.luggageCapacity =
        data.luggageCapacity
          ? Number(
              data.luggageCapacity
            )
          : null;
    }

    if (
      data.durationDays !==
      undefined
    ) {
      data.durationDays =
        data.durationDays
          ? Number(
              data.durationDays
            )
          : null;
    }

    if (
      data.maxGroupSize !==
      undefined
    ) {
      data.maxGroupSize =
        data.maxGroupSize
          ? Number(
              data.maxGroupSize
            )
          : null;
    }

    if (
      data.branchId !== undefined
    ) {
      const branch =
        await prisma.branch.findFirst({
          where: {
            id: Number(
              data.branchId
            ),
            ...listingWhere(req),
          },
        });

      if (!branch) {
        return res
          .status(404)
          .json({
            message:
              "Branch not found",
          });
      }

      data.branchId =
        branch.id;
    }

    
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM "Listing"
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (data.quantity !== undefined) {
          await assertListingQuantitySafe(
            tx,
            id,
            data.quantity
          );
        }

        await tx.listing.update({
          where: { id },
          data,
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );


        // A photo added while editing becomes the primary photo, in front
        // of the existing ones (it used to share position 0 with the old
        // first photo).
        if (carsxeImageUrl) {
        await prisma.$transaction(async (tx) => {
            const added = await tx.listingImage.create({
            data: {
                listingId: id,

                imageUrl:
                carsxeImageUrl,

                storageKey:
                null,

                sortOrder: 0,

                isPrimary: false,
            },
            });

            await writeImageOrder(id, [added.id], tx);
        });
        }

        const listing =
        await prisma.listing.findUnique({
            where: {
            id,
            },

            include:
            includeListingRelations(),
        });

        res.json({
        message:
            "Listing updated successfully",

        listing:
            mapListing(listing),
        });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// QUICK EDIT
// ==========================================================

export async function quickEditListing(
  req,
  res,
  next
) {
  try {
    const id = parseId(
      req.params.id,
      "listing id"
    );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id,
          ...listingWhere(req),
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found",
      });
    }

    const {
      price,
      quantity,
    } = req.body;

    const data = {};

    if (
      price !== undefined
    ) {
      const parsedPrice =
        Number(price);

      if (
        !Number.isFinite(
          parsedPrice
        ) ||
        parsedPrice < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid price",
          });
      }

      data.price =
        parsedPrice;
    }

    if (
      quantity !== undefined
    ) {
      const parsedQuantity =
        Number(quantity);

      if (
        !Number.isInteger(
          parsedQuantity
        ) ||
        parsedQuantity < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid quantity",
          });
      }

      data.quantity =
        parsedQuantity;
    }

    
    const updated = await prisma.$transaction(
      async (tx) => {
        // Serialize stock edits and booking creation.
        await tx.$queryRaw`
          SELECT id FROM "Listing"
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (data.quantity !== undefined) {
          await assertListingQuantitySafe(
            tx,
            id,
            data.quantity
          );
        }

        return tx.listing.update({
          where: { id },
          data,
          include: includeListingRelations(),
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    res.json({
      message:
        "Listing updated successfully",

      listing:
        mapListing(updated),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// PUBLISH
// ==========================================================

export async function publishListing(
  req,
  res,
  next
) {
  try {
    const id = parseId(
      req.params.id,
      "listing id"
    );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id,
          ...listingWhere(req),
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found",
      });
    }

    // Already published — no need to count it again.
    if (
      listing.status ===
      "PUBLISHED"
    ) {
      return res.status(400).json({
        message:
          "Listing is already published.",
      });
    }

    // Get the operator's subscription plan.
    const operator =
      await prisma.operator.findUnique({
        where: {
          id:
            listing.operatorId,
        },

        select: {
          subscriptionPlan:
            true,
        },
      });

    if (!operator) {
      return res.status(404).json({
        message:
          "Operator not found.",
      });
    }

    // A suspended subscription cannot put listings on sale.
    await assertSubscriptionActive(listing.operatorId);

    const listingLimit =
      getListingLimit(operator.subscriptionPlan, (await getPlatformSettings()).subscriptionTiers);

    // Count only currently published listings.
    const publishedCount =
      await prisma.listing.count({
        where: {
          operatorId:
            listing.operatorId,

          status:
            "PUBLISHED",
        },
      });

    // Block publishing when the plan limit is reached.
    if (
      publishedCount >=
      listingLimit
    ) {
      return res.status(403).json({
        message:
          `You have reached your ${operator.subscriptionPlan} plan listing limit of ${listingLimit} published listings.`,

        subscriptionPlan:
          operator.subscriptionPlan,

        listingLimit,

        publishedCount,
      });
    }

    const updated =
      await prisma.listing.update({
        where: {
          id,
        },

        data: {
          status:
            "PUBLISHED",
        },

        include:
          includeListingRelations(),
      });

    res.json({
      message:
        "Listing published successfully",

      listing:
        mapListing(updated),

      subscription: {
        plan:
          operator.subscriptionPlan,

        listingLimit,

        publishedCount:
          publishedCount + 1,

        remaining:
          listingLimit -
          (publishedCount + 1),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// WITHDRAW
// ==========================================================

export async function withdrawListing(
  req,
  res,
  next
) {
  try {
    const id = parseId(
      req.params.id,
      "listing id"
    );

    const listing =
      await prisma.listing.findFirst({
        where: {
          id,
          ...listingWhere(req),
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found",
      });
    }

    const updated =
      await prisma.listing.update({
        where: {
          id,
        },

        data: {
          status:
            "WITHDRAWN",
        },

        include:
          includeListingRelations(),
      });

    res.json({
      message:
        "Listing withdrawn successfully",

      listing:
        mapListing(updated),
    });
  } catch (err) {
    next(err);
  }
}

export async function suspendListing(req, res, next) {
  try {
    const id = parseId(req.params.id, "listing id");
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) return res.status(400).json({ message: "A suspension reason of at least 5 characters is required." });

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const updated = await prisma.listing.update({ where: { id }, data: { status: "SUSPENDED" }, include: includeListingRelations() });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "LISTING_SUSPENDED", entityType: "Listing", entityId: String(id), details: { reason, operatorId: listing.operatorId } },
    });
    res.json({ message: "Listing suspended successfully", listing: mapListing(updated) });
  } catch (err) {
    next(err);
  }
}

export async function reactivateListing(req, res, next) {
  try {
    const id = parseId(req.params.id, "listing id");
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) return res.status(400).json({ message: "A reactivation reason of at least 5 characters is required." });

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const updated = await prisma.listing.update({ where: { id }, data: { status: "PUBLISHED" }, include: includeListingRelations() });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "LISTING_REACTIVATED", entityType: "Listing", entityId: String(id), details: { reason, operatorId: listing.operatorId } },
    });
    res.json({ message: "Listing reactivated successfully", listing: mapListing(updated) });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// BULK STATUS
// ==========================================================

export async function bulkUpdateListingStatus(
  req,
  res,
  next
) {
  try {
    const {
      listingIds,
      status,
    } = req.body;

    if (
      !Array.isArray(listingIds) ||
      listingIds.length === 0
    ) {
      return res.status(400).json({
        message:
          "listingIds is required.",
      });
    }

    if (
      ![
        "PUBLISHED",
        "WITHDRAWN",
        "DRAFT",
      ].includes(status)
    ) {
      return res.status(400).json({
        message:
          "Invalid listing status.",
      });
    }

    const ids =
      listingIds.map(Number);

    if (
      ids.some(
        (id) =>
          !Number.isInteger(id) ||
          id <= 0
      )
    ) {
      return res.status(400).json({
        message:
          "One or more listing IDs are invalid.",
      });
    }

    // ======================================================
    // SUBSCRIPTION LIMIT CHECK FOR BULK PUBLISH
    // ======================================================

    if (status === "PUBLISHED") {
      const selectedListings =
        await prisma.listing.findMany({
          where: {
            id: {
              in: ids,
            },

            ...listingWhere(req),
          },

          select: {
            id: true,
            status: true,
            operatorId: true,

            operator: {
              select: {
                subscriptionPlan:
                  true,
              },
            },
          },
        });

      // Group selected listings by operator.
      const operatorGroups =
        new Map();

      for (
        const listing of
        selectedListings
      ) {
        // Already published listings
        // do not consume another slot.
        if (
          listing.status ===
          "PUBLISHED"
        ) {
          continue;
        }

        const existingGroup =
          operatorGroups.get(
            listing.operatorId
          );

        if (existingGroup) {
          existingGroup.newPublishCount +=
            1;
        } else {
          operatorGroups.set(
            listing.operatorId,
            {
              subscriptionPlan:
                listing.operator
                  ?.subscriptionPlan ||
                "FREE",

              newPublishCount: 1,
            }
          );
        }
      }

      const { subscriptionTiers } = await getPlatformSettings();

      // Check every operator involved.
      for (
        const [
          operatorId,
          group,
        ] of operatorGroups
      ) {
        await assertSubscriptionActive(operatorId);

        const listingLimit =
          getListingLimit(group.subscriptionPlan, subscriptionTiers);

        const publishedCount =
          await prisma.listing.count({
            where: {
              operatorId,

              status:
                "PUBLISHED",
            },
          });

        const remainingSlots =
          Math.max(
            0,
            listingLimit -
              publishedCount
          );

        if (
          publishedCount +
            group.newPublishCount >
          listingLimit
        ) {
          return res.status(403).json({
            message:
              `Cannot publish ${group.newPublishCount} selected listing(s). ` +
              `Your ${group.subscriptionPlan} plan allows ${listingLimit} published listings, ` +
              `and you only have ${remainingSlots} slot(s) remaining.`,

            subscriptionPlan:
              group.subscriptionPlan,

            listingLimit,

            publishedCount,

            requestedPublishCount:
              group.newPublishCount,

            remainingSlots,
          });
        }
      }
    }

    // ======================================================
    // UPDATE STATUS
    // ======================================================

    const result =
      await prisma.listing.updateMany({
        where: {
          id: {
            in: ids,
          },

          ...listingWhere(req),
        },

        data: {
          status,
        },
      });

    res.json({
      message:
        `${result.count} listing(s) updated successfully`,

      updatedCount:
        result.count,
    });
  } catch (err) {
    next(err);
  }
}