import { z } from "zod";

// ISO 8601 datetime string coerced to a Date object
const isoDate = z
  .string()
  .datetime({ message: "Invalid date – must be an ISO 8601 datetime string" })
  .transform((s) => new Date(s));

export const createBookingSchema = z.object({
  operatorId: z.number().int().positive().optional(),
  serviceName: z.string().trim().min(1, "Service name is required").max(200),
  serviceType: z.string().trim().max(100).optional(),
  bookingDate: isoDate,
  pickupDate: isoDate.optional(),
  returnDate: isoDate.optional(),
  location: z.string().trim().max(300).optional(),
  totalAmount: z
    .number()
    .positive("Total amount must be greater than 0")
    .max(1_000_000, "Total amount exceeds maximum"),
});
