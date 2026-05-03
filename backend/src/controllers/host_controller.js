import crypto from "crypto";
import prisma from "../config/db.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import { bookingSubmittedTemplate } from "../services/email_templates.js";

function generateIntentToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function generateBookingCode(tx) {
  const latest = await tx.booking.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextNumber = (latest?.id || 0) + 1;
  return `BNPL-${String(nextNumber).padStart(4, "0")}`;
}

function validateAmount(totalAmount) {
  const amount = Number(totalAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("totalAmount must be a positive number");
    error.statusCode = 400;
    throw error;
  }

  return amount;
}

function frontendUrl(path) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${baseUrl}${path}`;
}

function buildIntentUrls(intent) {
  const registerPath =
    `/register?hostToken=${encodeURIComponent(intent.token)}` +
    `&email=${encodeURIComponent(intent.customerEmail)}` +
    `&name=${encodeURIComponent(intent.customerName)}`;

  const loginPath =
    `/login?hostToken=${encodeURIComponent(intent.token)}` +
    `&email=${encodeURIComponent(intent.customerEmail)}`;

  return {
    registerUrl: frontendUrl(registerPath),
    loginUrl: frontendUrl(loginPath),
  };
}

async function buildIntentResponse(intent) {
  const urls = buildIntentUrls(intent);

  const existingCustomer = await prisma.user.findUnique({
    where: {
      email: intent.customerEmail,
    },
    select: {
      id: true,
      role: true,
    },
  });

  const shouldLogin =
    existingCustomer && existingCustomer.role === "CUSTOMER";

  return {
    intentToken: intent.token,
    customerEmail: intent.customerEmail,
    expiresAt: intent.expiresAt,
    registerUrl: urls.registerUrl,
    loginUrl: urls.loginUrl,
    redirectUrl: shouldLogin ? urls.loginUrl : urls.registerUrl,
    suggestedAction: shouldLogin ? "LOGIN" : "REGISTER",
  };
}

/**
 * Host entry point.
 * GoCar calls this endpoint after customer submits vehicle booking form.
 *
 * Important:
 * This does NOT create a customer account.
 * It only creates a temporary booking intent.
 */
export async function createHostBookingIntent(req, res, next) {
  try {
    const apiKey = req.headers["x-bnpl-api-key"];

    if (!process.env.HOST_API_KEY) {
      return res.status(500).json({
        message: "Host API key is not configured",
      });
    }

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

    const amount = validateAmount(totalAmount);

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
      },
    });

    if (existingBooking) {
      const checkoutPath = `/customer/checkout/${existingBooking.id}`;
      const loginUrl = frontendUrl(
        `/login?redirect=${encodeURIComponent(checkoutPath)}&email=${encodeURIComponent(
          existingBooking.customer.email
        )}`
      );

      return res.status(200).json({
        message: "Booking already exists",
        bookingId: existingBooking.id,
        bookingCode: existingBooking.bookingCode,
        checkoutUrl: frontendUrl(checkoutPath),
        loginUrl,
        redirectUrl: loginUrl,
        suggestedAction: "LOGIN",
      });
    }

    const existingIntent = await prisma.hostBookingIntent.findFirst({
      where: {
        hostBookingRef,
        operatorId: operator.id,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingIntent) {
      const intentResponse = await buildIntentResponse(existingIntent);

      return res.status(200).json({
        message: "Booking intent already exists",
        ...intentResponse,
      });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const intent = await prisma.hostBookingIntent.create({
      data: {
        token: generateIntentToken(),
        operatorId: operator.id,
        operatorCode,
        hostBookingRef,
        customerName,
        customerEmail,
        serviceName,
        serviceType: serviceType || null,
        bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        location: location || null,
        totalAmount: amount,
        payload: req.body,
        status: "PENDING",
        expiresAt,
      },
    });

    const intentResponse = await buildIntentResponse(intent);

    return res.status(201).json({
      message: "BNPL booking intent created",
      ...intentResponse,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer calls this after login.
 * This converts the host booking intent into a real BNPL booking.
 */
export async function claimHostBookingIntent(req, res, next) {
  try {
    const { token } = req.params;

    const intent = await prisma.hostBookingIntent.findUnique({
      where: { token },
    });

    if (!intent) {
      return res.status(404).json({
        message: "Booking intent not found",
      });
    }

    if (intent.status === "CLAIMED" && intent.claimedBookingId) {
      const booking = await prisma.booking.findFirst({
        where: {
          id: intent.claimedBookingId,
          customerId: req.user.id,
        },
      });

      if (!booking) {
        return res.status(403).json({
          message: "This booking intent has already been claimed",
        });
      }

      return res.json({
        message: "Booking intent already claimed",
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        checkoutUrl: frontendUrl(`/customer/checkout/${booking.id}`),
      });
    }

    if (intent.status !== "PENDING") {
      return res.status(400).json({
        message: `Booking intent is ${intent.status}`,
      });
    }

    if (intent.expiresAt < new Date()) {
      await prisma.hostBookingIntent.update({
        where: { id: intent.id },
        data: { status: "EXPIRED" },
      });

      return res.status(400).json({
        message: "Booking intent has expired. Please submit the GoCar booking again.",
      });
    }

    if (
      intent.customerEmail.toLowerCase() !== String(req.user.email).toLowerCase()
    ) {
      return res.status(403).json({
        message:
          "This booking was created for a different email address. Please login using the same email used in GoCar booking.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bookingCode = await generateBookingCode(tx);

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          hostBookingRef: intent.hostBookingRef,
          customerId: req.user.id,
          operatorId: intent.operatorId,
          serviceName: intent.serviceName,
          serviceType: intent.serviceType,
          bookingDate: intent.bookingDate,
          pickupDate: intent.pickupDate,
          returnDate: intent.returnDate,
          location: intent.location,
          totalAmount: intent.totalAmount,
          status: "PENDING",
        },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.hostBookingIntent.update({
        where: { id: intent.id },
        data: {
          status: "CLAIMED",
          claimedByUserId: req.user.id,
          claimedBookingId: booking.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "HOST_BOOKING_CLAIMED",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            hostBookingRef: intent.hostBookingRef,
            operatorCode: intent.operatorCode,
            intentToken: intent.token,
            source: "GoCar vehicle details page",
          },
        },
      });

      return booking;
    });

    const operatorUrl = frontendUrl(`/operator/bookings/${result.id}`);

    await notifyCustomerByBooking({
      booking: result,
      title: "Booking submitted",
      message: `Your BNPL booking ${result.bookingCode} has been submitted.`,
      type: "BOOKING_SUBMITTED",
    });

    await notifyOperatorUsersByBooking({
      booking: result,
      title: "New booking request",
      message: `${result.bookingCode} requires review.`,
      type: "BOOKING_SUBMITTED",
      emailSubject: `New BNPL Booking Request - ${result.bookingCode}`,
      emailHtml: bookingSubmittedTemplate({
        booking: result,
        operatorUrl,
      }),
    });

    return res.status(201).json({
      message: "BNPL booking created successfully",
      bookingId: result.id,
      bookingCode: result.bookingCode,
      checkoutUrl: frontendUrl(`/customer/checkout/${result.id}`),
    });
  } catch (err) {
    next(err);
  }
}