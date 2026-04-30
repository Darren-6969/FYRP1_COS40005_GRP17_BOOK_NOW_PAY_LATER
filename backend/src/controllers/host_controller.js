import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { bookingSubmittedTemplate } from "../services/email_templates.js";

function generateTempPassword() {
  return `Bnpl${Math.floor(100000 + Math.random() * 900000)}!`;
}

async function generateBookingCode(tx) {
  const latest = await tx.booking.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextNumber = (latest?.id || 0) + 1;
  return `BNPL-${String(nextNumber).padStart(4, "0")}`;
}

async function generateCustomerCode(tx) {
  const count = await tx.user.count({
    where: { role: "CUSTOMER" },
  });

  return `CUS${String(count + 1).padStart(4, "0")}`;
}

export async function createHostBooking(req, res, next) {
  try {
    const apiKey = req.headers["x-bnpl-api-key"];

    if (!apiKey || apiKey !== process.env.HOST_API_KEY) {
      return res.status(401).json({
        message: "Invalid host API key",
      });
    }

    const {
      operatorCode,
      hostBookingRef,
      customerName,
      customerEmail,
      customerPhone,
      serviceName,
      serviceType,
      bookingDate,
      pickupDate,
      returnDate,
      location,
      totalAmount,
    } = req.body;

    if (
      !operatorCode ||
      !hostBookingRef ||
      !customerName ||
      !customerEmail ||
      !serviceName ||
      totalAmount === undefined
    ) {
      return res.status(400).json({
        message:
          "operatorCode, hostBookingRef, customerName, customerEmail, serviceName and totalAmount are required",
      });
    }

    const operator = await prisma.operator.findUnique({
      where: { operatorCode },
    });

    if (!operator) {
      return res.status(404).json({
        message: "Operator not found",
      });
    }

    if (operator.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Operator is not active",
      });
    }

    const existingBooking = await prisma.booking.findFirst({
      where: {
        hostBookingRef,
        operatorId: operator.id,
      },
      include: {
        customer: true,
        operator: true,
        payment: true,
        receipt: true,
        invoice: true,
      },
    });

    if (existingBooking) {
      return res.status(200).json({
        message: "Booking already exists",
        bookingId: existingBooking.id,
        bookingCode: existingBooking.bookingCode,
        redirectUrl: `${process.env.FRONTEND_URL}/customer/bookings/${existingBooking.id}`,
      });
    }

    const tempPassword = generateTempPassword();

    const result = await prisma.$transaction(async (tx) => {
      let customer = await tx.user.findUnique({
        where: { email: customerEmail },
      });

      let isNewCustomer = false;

      if (!customer) {
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const userCode = await generateCustomerCode(tx);

        customer = await tx.user.create({
          data: {
            userCode,
            name: customerName,
            email: customerEmail,
            phone: customerPhone || null,
            password: hashedPassword,
            role: "CUSTOMER",
          },
        });

        isNewCustomer = true;
      }

      const bookingCode = await generateBookingCode(tx);

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          hostBookingRef,
          customerId: customer.id,
          operatorId: operator.id,
          serviceName,
          serviceType: serviceType || null,
          bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
          pickupDate: pickupDate ? new Date(pickupDate) : null,
          returnDate: returnDate ? new Date(returnDate) : null,
          location: location || null,
          totalAmount,
          status: "PENDING",
        },
        include: {
          customer: true,
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: customer.id,
          action: "HOST_BOOKING_CREATED",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            operatorCode,
            hostBookingRef,
            source: "GoCar cPanel website",
            isNewCustomer,
          },
        },
      });

      return {
        customer,
        booking,
        isNewCustomer,
      };
    });

    const customerUrl = `${process.env.FRONTEND_URL}/customer/bookings/${result.booking.id}`;
    const operatorUrl = `${process.env.FRONTEND_URL}/operator/bookings/${result.booking.id}`;

    await notifyCustomerByBooking({
      booking: result.booking,
      title: "Booking submitted",
      message: `Your BNPL booking ${result.booking.bookingCode} has been submitted.`,
      type: "BOOKING_SUBMITTED",
    });

    await notifyOperatorUsersByBooking({
      booking: result.booking,
      title: "New booking request",
      message: `${result.booking.bookingCode} requires review.`,
      type: "BOOKING_SUBMITTED",
      emailSubject: `New BNPL Booking Request - ${result.booking.bookingCode}`,
      emailHtml: bookingSubmittedTemplate({
        booking: result.booking,
        operatorUrl,
      }),
    });

    return res.status(201).json({
      message: "BNPL booking created successfully",
      bookingId: result.booking.id,
      bookingCode: result.booking.bookingCode,
      customerEmail: result.customer.email,
      isNewCustomer: result.isNewCustomer,
      redirectUrl: customerUrl,
    });
  } catch (err) {
    next(err);
  }
}