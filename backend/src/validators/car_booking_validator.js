import { z } from "zod";

const plainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");

// Mirrors the page's selection object so the frontend can post it as is.
export const carQuoteSchema = z.object({
  from: plainDate.optional(),
  to: plainDate.optional(),
  ft: hhmm.default("10:00"),
  tt: hhmm.default("10:00"),
  pickupPointId: z.union([z.string(), z.number()]).optional().nullable(),
  addOns: z.record(z.string(), z.number().int().min(0).max(20)).default({}),
  driverDob: plainDate.optional().nullable(),
  age: z.number().int().min(16).max(120).optional().nullable(),
});

// Identifiers and choices only. The server prices the booking.
export const carBookingSchema = z.object({
  listingId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  pickupAt: z.string().datetime({ offset: true }),
  returnAt: z.string().datetime({ offset: true }),
  pickupPointId: z.union([z.string(), z.number()]).optional().nullable(),
  addOns: z
    .array(z.object({ id: z.union([z.string(), z.number()]), quantity: z.number().int().min(1).max(20) }))
    .max(20)
    .default([]),
  bookingDetails: z.object({
    contact: z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().email().nullable().optional(),
      phone: z.string().regex(/^\+60\d{8,11}$/, "Expected a Malaysian number, e.g. +60123456789"),
    }),
    driver: z.object({
      isBooker: z.boolean(),
      fullName: z.string().trim().min(2).max(120),
      dateOfBirth: plainDate,
      licenceIssuedIn: z.string().trim().min(2).max(60),
    }),
    agreements: z.object({
      termsOfServiceAcceptedAt: z.string().datetime({ offset: true }),
      rentalTermsAcceptedAt: z.string().datetime({ offset: true }),
    }),
  }),
});
