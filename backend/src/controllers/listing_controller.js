import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";

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

    res.json({
      listings:
        listings.map(
          mapListing
        ),
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

      price,
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

          price:
            Number(price),

          quantity:
            Math.max(
              0,
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

    if (
      data.price !== undefined
    ) {
      data.price =
        Number(data.price);
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
      !Array.isArray(
        listingIds
      ) ||
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
      listingIds.map(
        Number
      );

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