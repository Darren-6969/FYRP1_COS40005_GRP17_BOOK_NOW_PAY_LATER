import { z } from "zod";

const plainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
const pointId = z.union([z.string().max(20), z.number().int().positive()]).optional().nullable();

// The selection the tour pages post. The server prices it.
export const tourQuoteSchema = z.object({
  date: plainDate,
  pickupTime: hhmm,
  passengers: z.number().int().min(1).max(100),
  pickupPointId: pointId,
});

// Identifiers and choices only. The server prices the booking.
export const tourBookingSchema = tourQuoteSchema.extend({
  listingId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  bookingDetails: z.object({
    contact: z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().email().nullable().optional(),
      phone: z.string().regex(/^\+60\d{8,11}$/, "Expected a Malaysian number, e.g. +60123456789"),
    }),
    // Anything the operator should know: hotel name, children, mobility needs.
    note: z.string().trim().max(500).optional().nullable(),
    agreements: z.object({
      termsOfServiceAcceptedAt: z.string().datetime({ offset: true }),
      tourTermsAcceptedAt: z.string().datetime({ offset: true }),
      // The forfeiture rule is acknowledged on its own, as for cars.
      forfeitureAcceptedAt: z.string().datetime({ offset: true }),
    }),
  }),
});
