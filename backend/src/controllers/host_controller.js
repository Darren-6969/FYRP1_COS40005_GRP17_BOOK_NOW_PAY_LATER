import crypto from "crypto";
import prisma from "../config/db.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import { bookingSubmittedTemplate } from "../services/email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";
import { calculatePaymentDeadline } from "../services/payment_deadline_service.js";
import { tempBookingCode, formatBookingCode } from "../utils/bookingCode.js";
import { hashApiKey } from "../utils/apiKey.js";
import bcrypt from "bcryptjs";
import { generateUserCode } from "../services/userCode.js";
import { issueTokenPair, sanitizeUser } from "./auth_controller.js";
import { sendEmail } from "../services/email_service.js";

async function mintHandoff(intentId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const handoffTokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const handoffExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

  await prisma.hostBookingIntent.update({
    where: { id: intentId },
    data: { handoffTokenHash, handoffExpiresAt, handoffUsedAt: null },
  });

  return raw;
}

function generateIntentToken() {
  return crypto.randomBytes(32).toString("hex");
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
    combinedDateTime,
    date
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
  const handoffToken = await mintHandoff(intent.id);

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
    handoffToken,                          
    handoffExpiresInSeconds: 180,          
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
// Delegated identity: provision or load the customer the host vouched for.
async function provisionCustomerForIntent(intent) {
  const email = normalizeEmail(intent.customerEmail);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "CUSTOMER") {
      const err = new Error("This email is registered as a non-customer account.");
      err.statusCode = 409;
      throw err;
    }
    return { user: existing, provisioned: false };
  }

  // New customer: unusable random password, RESTRICTED until OTP step-up.
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, 12);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const userCode = await generateUserCode("CUSTOMER");
      const user = await prisma.user.create({
        data: {
          userCode,
          name: intent.customerName,
          email,
          password: hashedPassword,
          role: "CUSTOMER",
          provisionedVia: "HOST",
          customerStatus: "RESTRICTED",
        },
      });
      return { user, provisioned: true };
    } catch (e) {
      if (e.code !== "P2002") throw e;
      const target = Array.isArray(e.meta?.target)
        ? e.meta.target.join(",")
        : String(e.meta?.target || "");
      if (!target.includes("userCode")) throw e;
    }
  }

  throw new Error("Failed to provision customer");
}

// Shared booking creation used by both claim (tab flow) and exchange (modal flow).
async function createBookingFromIntent(intent, user) {
  const defaultPaymentDeadline = await calculatePaymentDeadline(
    intent.operatorId,
    null,
    intent.pickupDate
  );

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingCode: tempBookingCode(),
        hostBookingRef: intent.hostBookingRef,
        customerId: user.id,
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
    });

    const full = await tx.booking.update({
      where: { id: created.id },
      data: { bookingCode: formatBookingCode(created.id) },
      include: {
        customer: { select: { id: true, userCode: true, name: true, email: true } },
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
        claimedByUserId: user.id,
        claimedBookingId: full.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "HOST_BOOKING_CLAIMED",
        entityType: "Booking",
        entityId: String(full.id),
        details: {
          hostBookingRef: intent.hostBookingRef,
          operatorCode: intent.operatorCode,
          intentToken: intent.token,
        },
      },
    });

    return full;
  }, { timeout: 15000 });

  const operatorUrl = frontendUrl(`/operator/bookings/${booking.id}`);

  await notifyCustomerByBooking({
    booking,
    title: "Booking submitted",
    message: `Your BNPL booking ${booking.bookingCode} has been submitted.`,
    type: "BOOKING_SUBMITTED",
  });

  await notifyOperatorUsersByBooking({
    booking,
    title: "New booking request",
    message: `${booking.bookingCode} requires review.`,
    type: "BOOKING_SUBMITTED",
    emailSubject: `New BNPL Booking Request - ${booking.bookingCode}`,
    emailHtml: bookingSubmittedTemplate({ booking, operatorUrl }),
  });

  return booking;
}

export async function createHostBookingIntent(req, res, next) {
  try {
    const apiKey = req.headers["x-bnpl-api-key"];

    if (!apiKey) {
      return res.status(401).json({ message: "Missing host API key" });
    }

    // Per-operator key lookup (Phase 1). The key authoritatively identifies
    // the operator. Falls back to the legacy global HOST_API_KEY during
    // migration so existing hosts keep working until they switch keys.
    const keyedOperator = await prisma.operator.findUnique({
      where: { apiKeyHash: hashApiKey(apiKey) },
    });

    const legacyKeyValid =
      Boolean(process.env.HOST_API_KEY) && apiKey === process.env.HOST_API_KEY;

    if (!keyedOperator && !legacyKeyValid) {
      return res.status(401).json({ message: "Invalid host API key" });
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

    validateAmount(totalAmount);
    
    // When a per-operator key was used, that key decides the operator and the
    // body operatorCode must match it (prevents booking under another operator).
    let operator;

    if (keyedOperator) {
      if (operatorCode && operatorCode !== keyedOperator.operatorCode) {
        return res.status(403).json({
          message: "operatorCode does not match the API key's operator",
        });
      }
      operator = keyedOperator;
    } else {
      operator = await prisma.operator.findUnique({
        where: { operatorCode },
      });
    }

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
        payload: {
          operatorCode,
          hostBookingRef,
          serviceName,
          serviceType: serviceType || null,
        },
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

    const result = await createBookingFromIntent(intent, req.user);

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

/**
 * Model B — embedded modal session.
 * The single-use handoff token is the credential (no Authorization header).
 * Provisions/loads the customer, claims the intent, and issues a JWT.
 */
export async function exchangeHostSession(req, res, next) {
  try {
    const { handoffToken } = req.body;

    if (!handoffToken) {
      return res.status(400).json({ message: "handoffToken is required" });
    }

    const handoffTokenHash = crypto
      .createHash("sha256")
      .update(String(handoffToken))
      .digest("hex");

    const intent = await prisma.hostBookingIntent.findUnique({
      where: { handoffTokenHash },
    });

    if (!intent) {
      return res.status(404).json({ message: "Invalid handoff token" });
    }
    if (intent.handoffUsedAt) {
      return res.status(400).json({ message: "This session link has already been used" });
    }
    if (!intent.handoffExpiresAt || intent.handoffExpiresAt < new Date()) {
      return res.status(400).json({ message: "This session link has expired" });
    }

    const operator = await prisma.operator.findUnique({
      where: { id: intent.operatorId },
    });
    if (!operator || operator.status !== "ACTIVE") {
      return res.status(403).json({ message: "Operator is not active" });
    }

    // Single-use: burn the token before doing anything else.
    await prisma.hostBookingIntent.update({
      where: { id: intent.id },
      data: { handoffUsedAt: new Date() },
    });

    const { user } = await provisionCustomerForIntent(intent);

    let booking;
    if (intent.status === "CLAIMED" && intent.claimedBookingId) {
      booking = await prisma.booking.findFirst({
        where: { id: intent.claimedBookingId, customerId: user.id },
      });
      if (!booking) {
        return res.status(403).json({ message: "This booking belongs to a different account" });
      }
    } else if (intent.status === "PENDING") {
      if (intent.expiresAt < new Date()) {
        await prisma.hostBookingIntent.update({
          where: { id: intent.id },
          data: { status: "EXPIRED" },
        });
        return res.status(400).json({ message: "Booking intent has expired" });
      }
      booking = await createBookingFromIntent(intent, user);
    } else {
      return res.status(400).json({ message: `Booking intent is ${intent.status}` });
    }

    const { accessToken, refreshToken } = await issueTokenPair(
      user.id,
      user.role,
      user.operatorAccessLevel || null
    );

    return res.status(200).json({
      message: "Session established",
      authToken: accessToken,
      refreshToken,
      needsOtp: user.customerStatus === "RESTRICTED",
      user: sanitizeUser(user),
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      bookingDetailUrl: frontendUrl(`/customer/bookings/${booking.id}`),
      checkoutUrl: frontendUrl(`/customer/checkout/${booking.id}`),
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
}

/**
 * OTP step-up: send a code to a RESTRICTED (host-provisioned) customer.
 * Called with the restricted JWT from exchange.
 */
export async function requestHostOtp(req, res, next) {
  try {
    if (req.user.customerStatus !== "RESTRICTED") {
      return res.status(400).json({ message: "Your account is already verified" });
    }

    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] OTP for", req.user.email, "=", otp);
    }
    const otpCodeHash = crypto.createHash("sha256").update(otp).digest("hex");

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        otpCodeHash,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        otpAttempts: 0,
      },
    });

    await sendEmail({
      to: req.user.email,
      subject: "Your BNPL verification code",
      type: "OTP_VERIFICATION",
      userId: req.user.id,
      text: `Your BNPL verification code is ${otp}. It expires in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;">
        <h2>Verification code</h2>
        <p>Use this code to continue your BNPL booking:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>`,
    });

    return res.json({ message: "Verification code sent" });
  } catch (err) {
    next(err);
  }
}

/**
 * OTP step-up: verify the code, promote the customer to ACTIVE,
 * and issue a fresh (unrestricted) token pair.
 */
export async function verifyHostOtp(req, res, next) {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: "otp is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (user.customerStatus !== "RESTRICTED") {
      return res.status(400).json({ message: "Your account is already verified" });
    }
    if (!user.otpCodeHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }
    if (user.otpAttempts >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCodeHash: null, otpExpiresAt: null, otpAttempts: 0 },
      });
      return res.status(429).json({ message: "Too many attempts. Please request a new code." });
    }

    const hash = crypto.createHash("sha256").update(String(otp)).digest("hex");
    if (hash !== user.otpCodeHash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      return res.status(400).json({ message: "Invalid code" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { customerStatus: "ACTIVE", otpCodeHash: null, otpExpiresAt: null, otpAttempts: 0 },
      include: { operator: true },
    });

    const { accessToken, refreshToken } = await issueTokenPair(
      updated.id,
      updated.role,
      updated.operatorAccessLevel || null
    );

    return res.json({
      message: "Verified",
      token: accessToken,
      refreshToken,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    next(err);
  }
}