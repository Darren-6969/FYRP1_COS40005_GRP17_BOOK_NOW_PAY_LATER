import cron from "node-cron";
import prisma from "../config/db.js";
import { sendOverdueEmail } from "../services/email_service.js";

/**
 * Runs every hour.
 * Marks overdue payments and cancels unpaid bookings past their deadline.
 */
export function startPaymentExpiryJob() {
  cron.schedule("0 * * * *", async () => {
    console.log("[PaymentExpiry] Running overdue check...");
    try {
      const now = new Date();

      // Find all accepted bookings past deadline with unpaid payment
      const expired = await prisma.booking.findMany({
        where: {
          status: { in: ["ACCEPTED", "PENDING_PAYMENT"] },
          paymentDeadline: { lt: now },
          payment: { status: { in: ["UNPAID", "PENDING_VERIFICATION"] } },
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          payment: true,
        },
      });

      console.log(`[PaymentExpiry] Found ${expired.length} overdue bookings`);

      for (const booking of expired) {
        await prisma.$transaction([
          prisma.booking.update({
            where: { id: booking.id },
            data: { status: "OVERDUE" },
          }),
          prisma.payment.update({
            where: { bookingId: booking.id },
            data: { status: "OVERDUE" },
          }),
          prisma.auditLog.create({
            data: {
              action: "BOOKING_OVERDUE",
              entityType: "Booking",
              entityId: booking.id,
              details: { reason: "Payment deadline passed" },
            },
          }),
          prisma.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Booking Overdue",
              message: `Your payment for booking ${booking.id} is overdue. Please contact support.`,
              type: "WARNING",
            },
          }),
        ]);

        // Send email
        await sendOverdueEmail(
          booking.customer.email,
          booking.customer.name,
          booking.id,
          booking.serviceName
        );

        console.log(`[PaymentExpiry] Marked overdue: ${booking.id}`);
      }
    } catch (err) {
      console.error("[PaymentExpiry] Job failed:", err.message);
    }
  });

  console.log("[PaymentExpiry] Scheduler started — hourly check");
}
