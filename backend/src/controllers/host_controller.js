import crypto from "crypto";
import prisma from "../config/db.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import { bookingSubmittedTemplate } from "../services/email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";
import { calculatePaymentDeadline } from "../services/payment_deadline_service.js";

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function firstPresent(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  );
}

function hasTimeComponent(value) {
  if (!value) return false;
  return /[T\s]\d{1,2}:\d{2}(?::\d{2})?/.test(String(value));
}

function normalizeDateOnly(value) {
  if (!value) return null;

  const raw = String(value).trim();

  // Accept "2026-05-12"
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) return raw;

  // Accept "2026-05-12T00:00:00" or "2026-05-12 00:00:00"
  const datePartMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (datePartMatch) {
    return `${datePartMatch[1]}-${datePartMatch[2]}-${datePartMatch[3]}`;
  }

  return raw;
}

function normalizeTime(value) {
  if (!value) return null;

  let time = String(value).trim();

  // Accept "2 AM", "2:00 AM", "02:00 am"
  const ampmMatch = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = ampmMatch[2] || "00";
    const period = ampmMatch[3].toUpperCase();

    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  // Accept "02:00", "2:00"
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);

  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = timeMatch[2];

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  return time;
}

function combineDateAndTime(dateValue, timeValue) {
  const date = normalizeDateOnly(dateValue);
  const time = normalizeTime(timeValue);

  if (!date || !time) return null;

  return `${date}T${time}:00`;
}

function resolveHostDateTime({
  datetime,
  date,
  time,
  fieldName,
  required = false,
}) {
  const combinedDateTime = combineDateAndTime(date, time);

  const value = firstPresent(
    datetime,
    combinedDateTime
  );

  if (!value) {
    if (required) {
      const error = new Error(`${fieldName} is required`);
      error.statusCode = 400;
      throw error;
    }

    return null;
  }

  if (!hasTimeComponent(value)) {
    const error = new Error(
      `${fieldName} must include time. Send either ${fieldName}Time or separate date and time fields. Example: 2026-05-12T02:00:00`
    );
    error.statusCode = 400;
    throw error;
  }

  return parseMalaysiaLocalDateTime(value);
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
      email: normalizeEmail(intent.customerEmail),
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
    pickupTime,
    pickupDateTime,
    pickup_date,
    pickup_time,
    pickup_datetime,
    pickUpDate,
    pickUpTime,
    pickUpDateTime,

    checkInDate,
    checkInTime,
    checkInDateTime,
    check_in_date,
    check_in_time,
    check_in_datetime,
    startDate,
    startTime,
    startDateTime,

    returnDate,
    returnTime,
    returnDateTime,
    return_date,
    return_time,
    return_datetime,

    checkOutDate,
    checkOutTime,
    checkOutDateTime,
    check_out_date,
    check_out_time,
    check_out_datetime,

    dropoffDate,
    dropoffTime,
    dropoffDateTime,
    dropoff_date,
    dropoff_time,
    dropoff_datetime,
    dropOffDate,
    dropOffTime,
    dropOffDateTime,
    endDate,
    endTime,
    endDateTime,

    location,
    totalAmount,
  } = req.body;

    const safeCustomerEmail = normalizeEmail(customerEmail);

    if (
      !operatorCode ||
      !hostBookingRef ||
      !customerName ||
      !safeCustomerEmail ||
      !serviceName ||
      totalAmount === undefined
    ) {
      return res.status(400).json({
        message:
          "operatorCode, hostBookingRef, customerName, customerEmail, serviceName and totalAmount are required",
      });
    }

    const amount = validateAmount(totalAmount);
        
    if (pickupDate && !hasTimeComponent(pickupDate)) {
      return res.status(400).json({
        message:
          "pickupDate must include time. Example: 2026-05-11T03:00:00",
      });
    }

    if (returnDate && !hasTimeComponent(returnDate)) {
      return res.status(400).json({
        message:
          "returnDate must include time. Example: 2026-05-15T02:00:00",
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

    /**
     * If GoCar submitted the same booking before and the real BNPL booking
     * already exists, send the customer to login first, then redirect them
     * to the BNPL booking details page.
     */
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
      const bookingDetailPath = `/customer/bookings/${existingBooking.id}`;

      const loginUrl = frontendUrl(
        `/login?redirect=${encodeURIComponent(
          bookingDetailPath
        )}&email=${encodeURIComponent(existingBooking.customer.email)}`
      );

      return res.status(200).json({
        message: "Booking already exists",
        bookingId: existingBooking.id,
        bookingCode: existingBooking.bookingCode,
        bookingDetailUrl: frontendUrl(bookingDetailPath),
        checkoutUrl: frontendUrl(`/customer/checkout/${existingBooking.id}`),
        loginUrl,
        redirectUrl: loginUrl,
        suggestedAction: "LOGIN",
      });
    }

    /**
     * If there is already a pending unclaimed intent, reuse it instead of
     * creating duplicate pending intents.
     */
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

    const submittedAt = bookingDate
      ? parseMalaysiaLocalDateTime(bookingDate)
      : new Date();

    const parsedPickupDate = resolveHostDateTime({
      datetime: firstPresent(
        pickupDateTime,
        pickup_datetime,
        pickUpDateTime,
        checkInDateTime,
        check_in_datetime,
        startDateTime
      ),
      date: firstPresent(
        pickupDate,
        pickup_date,
        pickUpDate,
        checkInDate,
        check_in_date,
        startDate
      ),
      time: firstPresent(
        pickupTime,
        pickup_time,
        pickUpTime,
        checkInTime,
        check_in_time,
        startTime
      ),
      fieldName: "pickupDate",
      required: true,
    });

    const parsedReturnDate = resolveHostDateTime({
      datetime: firstPresent(
        returnDateTime,
        return_datetime,
        checkOutDateTime,
        check_out_datetime,
        dropoffDateTime,
        dropoff_datetime,
        dropOffDateTime,
        endDateTime
      ),
      date: firstPresent(
        returnDate,
        return_date,
        checkOutDate,
        check_out_date,
        dropoffDate,
        dropoff_date,
        dropOffDate,
        endDate
      ),
      time: firstPresent(
        returnTime,
        return_time,
        checkOutTime,
        check_out_time,
        dropoffTime,
        dropoff_time,
        dropOffTime,
        endTime
      ),
      fieldName: "returnDate",
      required: true,
    });

    console.log("[Host Booking Datetime Debug]", {
      hostBookingRef,
      rawPickupFields: {
        pickupDate,
        pickupTime,
        pickupDateTime,
        pickup_date,
        pickup_time,
        pickup_datetime,
        checkInDate,
        checkInTime,
        checkInDateTime,
        startDate,
        startTime,
        startDateTime,
      },
      rawReturnFields: {
        returnDate,
        returnTime,
        returnDateTime,
        return_date,
        return_time,
        return_datetime,
        checkOutDate,
        checkOutTime,
        checkOutDateTime,
        dropoffDate,
        dropoffTime,
        dropoffDateTime,
        endDate,
        endTime,
        endDateTime,
      },
      parsedPickupDate,
      parsedReturnDate,
    });

    const intent = await prisma.hostBookingIntent.create({
      data: {
        token: generateIntentToken(),
        operatorId: operator.id,
        operatorCode,
        hostBookingRef,
        customerName: String(customerName).trim(),
        customerEmail: safeCustomerEmail,
        serviceName,
        serviceType: serviceType || null,
        bookingDate: submittedAt,
        pickupDate: parsedPickupDate,
        returnDate: parsedReturnDate,
        location: location || null,
        totalAmount: totalAmount,
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

    /**
     * If the intent was already claimed by the same logged-in customer,
     * send them to booking details, not checkout.
     */
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
        bookingDetailUrl: frontendUrl(`/customer/bookings/${booking.id}`),
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
        message:
          "Booking intent has expired. Please submit the GoCar booking again.",
      });
    }

    if (normalizeEmail(intent.customerEmail) !== normalizeEmail(req.user.email)) {
      return res.status(403).json({
        message:
          "This booking was created for a different email address. Please login using the same email used in GoCar booking.",
      });
    }

    const defaultPaymentDeadline = await calculatePaymentDeadline(
      intent.operatorId,
      null,
      intent.pickupDate
    );
    
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
          paymentDeadline: defaultPaymentDeadline,
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
      bookingDetailUrl: frontendUrl(`/customer/bookings/${result.id}`),
      checkoutUrl: frontendUrl(`/customer/checkout/${result.id}`),
    });
  } catch (err) {
    next(err);
  }
}