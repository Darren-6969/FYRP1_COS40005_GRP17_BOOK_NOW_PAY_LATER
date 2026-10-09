import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";

import {
  validateRateCard,
} from "../services/listing_rates.js";

import {
  getListingLimit,
} from "../services/subscription_service.js";

import {
  ACTIVE_BOOKING_STATUSES,
  occupiedDates,
} from "../services/car_availability_service.js";

import { getPlatformSettings } from "../services/platform_settings_service.js";

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

export async function blockListingForServicing(
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

    const {
      fromDate,
      toDate,
      blockedQuantity,
      note,
    } = req.body;

    // =========================
    // Validate dates
    // =========================

    if (
      !isPlainDate(fromDate) ||
      !isPlainDate(toDate)
    ) {
      return res.status(400).json({
        message:
          "Valid servicing start and end dates are required.",
      });
    }

    if (toDate < fromDate) {
      return res.status(400).json({
        message:
          "Servicing end date cannot be earlier than the start date.",
      });
    }

    // =========================
    // Validate quantity
    // =========================

    const servicingQuantity =
      Number(blockedQuantity);

    if (
      !Number.isInteger(
        servicingQuantity
      ) ||
      servicingQuantity < 1
    ) {
      return res.status(400).json({
        message:
          "Servicing quantity must be at least 1.",
      });
    }

    // =========================
    // Find listing
    // =========================

    const listing =
      await prisma.listing.findFirst({
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
      return res.status(404).json({
        message:
          "Listing not found.",
      });
    }

    const totalQuantity =
      Number(
        listing.quantity || 0
      );

    if (
      servicingQuantity >
      totalQuantity
    ) {
      return res.status(400).json({
        message:
          `This listing only has ${totalQuantity} vehicle(s).`,
      });
    }

    // =========================
    // Build selected dates
    // =========================

    const dates = [];

    for (
      let current = fromDate;
      current <= toDate;
      current =
        addPlainDateDays(
          current,
          1
        )
    ) {
      dates.push(current);
    }

    const startDate =
      new Date(
        `${fromDate}T00:00:00+08:00`
      );

    const endExclusive =
      new Date(
        `${addPlainDateDays(
          toDate,
          1
        )}T00:00:00+08:00`
      );

    // =========================
    // Load current allocations
    // =========================

    const allocations =
      await prisma
        .listingAllocation
        .findMany({
          where: {
            listingId,

            date: {
              gte:
                new Date(
                  `${fromDate}T00:00:00.000Z`
                ),

              lt:
                new Date(
                  `${addPlainDateDays(
                    toDate,
                    1
                  )}T00:00:00.000Z`
                ),
            },
          },
        });

    const allocationMap =
      new Map(
        allocations.map(
          (allocation) => [
            allocation.date
              .toISOString()
              .slice(0, 10),

            allocation,
          ]
        )
      );

    // =========================
    // Load bookings
    // =========================

    const bookings =
      await prisma.booking.findMany({
        where: {
          listingId,

          status: {
            in:
              ACTIVE_BOOKING_STATUSES,
          },

          pickupDate: {
            lt: endExclusive,
          },

          returnDate: {
            gt: startDate,
          },
        },

        select: {
          id: true,
          bookingCode: true,
          pickupDate: true,
          returnDate: true,
        },
      });

    // =========================
    // Validate each day
    // =========================

    for (const date of dates) {
      const allocation =
        allocationMap.get(date);

      const dailyCapacity =
        Number(
          allocation?.quantity ??
            totalQuantity
        );

      const bookingCount =
        bookings.filter(
          (booking) =>
            occupiedDates(
              booking
            ).includes(date)
        ).length;

      const remainingAfterServicing =
        dailyCapacity -
        servicingQuantity -
        bookingCount;

      if (
        remainingAfterServicing < 0
      ) {
        return res.status(409).json({
          message:
            `Cannot service ${servicingQuantity} vehicle(s) on ${date}. ` +
            `${bookingCount} vehicle(s) are already booked and only ${dailyCapacity} are available in the fleet.`,
        });
      }
    }

    // =========================
    // Save servicing blocks
    // =========================

    const cleanNote =
      String(
        note ||
          "Scheduled servicing"
      ).trim() ||
      "Scheduled servicing";

    await prisma.$transaction(
      dates.map((date) => {
        const allocation =
          allocationMap.get(date);

        const dailyCapacity =
          Number(
            allocation?.quantity ??
              totalQuantity
          );

        return prisma
          .listingAllocation
          .upsert({
            where: {
              listingId_date: {
                listingId,

                date:
                  new Date(
                    `${date}T00:00:00.000Z`
                  ),
              },
            },

            create: {
              listingId,

              date:
                new Date(
                  `${date}T00:00:00.000Z`
                ),

              blockedQuantity:
                servicingQuantity,

              isBlocked:
                servicingQuantity >=
                dailyCapacity,

              note:
                cleanNote,
            },

            update: {
              blockedQuantity:
                servicingQuantity,

              isBlocked:
                servicingQuantity >=
                dailyCapacity,

              note:
                cleanNote,
            },
          });
      })
    );

    res.json({
      message:
        "Servicing allocation saved successfully.",

      listingId,

      totalQuantity,

      blockedQuantity:
        servicingQuantity,

      fromDate,
      toDate,

      blockedDates:
        dates,

      note:
        cleanNote,
    });
  } catch (err) {
    next(err);
  }
}

export async function unblockListingServicing(
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

    const {
      fromDate,
      toDate,
    } = req.body;

    if (
      !isPlainDate(fromDate) ||
      !isPlainDate(toDate)
    ) {
      return res.status(400).json({
        message:
          "Valid start and end dates are required.",
      });
    }

    if (toDate < fromDate) {
      return res.status(400).json({
        message:
          "End date cannot be earlier than the start date.",
      });
    }

    const listing =
      await prisma.listing.findFirst({
        where: {
          id: listingId,
          ...listingWhere(req),
        },

        select: {
          id: true,
        },
      });

    if (!listing) {
      return res.status(404).json({
        message:
          "Listing not found.",
      });
    }

    const dates = [];

    for (
      let current = fromDate;
      current <= toDate;
      current =
        addPlainDateDays(
          current,
          1
        )
    ) {
      dates.push(current);
    }

    await prisma.$transaction(
      dates.map((date) =>
        prisma.listingAllocation.updateMany({
          where: {
            listingId,

            date:
              new Date(
                `${date}T00:00:00.000Z`
              ),
          },

          data: {
            blockedQuantity: 0,
            isBlocked: false,
            note: null,
          },
        })
      )
    );

    res.json({
      message:
        "Servicing block removed successfully.",

      listingId,

      unblockedDates:
        dates,
    });
  } catch (err) {
    next(err);
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

    if (
      data.quantity !== undefined
    ) {
      data.quantity =
        Number(data.quantity);
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

    await prisma.listing.update({
        where: {
            id,
        },

        data,
        });

        if (carsxeImageUrl) {
        await prisma.$transaction([
            prisma.listingImage.updateMany({
            where: {
                listingId: id,
            },

            data: {
                isPrimary: false,
            },
            }),

            prisma.listingImage.create({
            data: {
                listingId: id,

                imageUrl:
                carsxeImageUrl,

                storageKey:
                null,

                sortOrder: 0,

                isPrimary: true,
            },
            }),
        ]);
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

    const updated =
      await prisma.listing.update({
        where: {
          id,
        },

        data,

        include:
          includeListingRelations(),
      });

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