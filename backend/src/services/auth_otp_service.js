import crypto from "crypto";
import prisma from "../config/db.js";
import { isReservedTestAddress, sendEmail } from "./email_service.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export class OtpDeliveryError extends Error {}

export function resolveOtpRecipient(email, env = process.env) {
  if (!isReservedTestAddress(email)) return email;

  if ((env.NODE_ENV || "").trim().toLowerCase() === "production") {
    throw new OtpDeliveryError(
      "This account uses a reserved test email address. Update it to a real email address before signing in."
    );
  }

  const override = (env.AUTH_OTP_TEST_RECIPIENT || "").trim();
  if (!override) {
    throw new OtpDeliveryError(
      "This demo account uses a reserved test email address and cannot receive email. Set AUTH_OTP_TEST_RECIPIENT to a real inbox in development."
    );
  }

  if (
    override.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(override)
    || isReservedTestAddress(override)
  ) {
    throw new OtpDeliveryError(
      "AUTH_OTP_TEST_RECIPIENT must be a deliverable, non-test email address."
    );
  }

  return override;
}

export function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(userId, purpose, code, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error("JWT_SECRET is required to hash authentication OTPs.");
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${purpose}:${code}`)
    .digest("hex");
}

export async function sendOtp({ user, purpose }) {
  const recipient = resolveOtpRecipient(user.email);
  const code = generateOtpCode();
  const codeHash = hashOtp(user.id, purpose, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpChallenge.upsert({
    where: { userId_purpose: { userId: user.id, purpose } },
    update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
    create: { userId: user.id, purpose, codeHash, expiresAt },
  });

  const isEmailVerification = purpose === "EMAIL_VERIFICATION";
  const result = await sendEmail({
    to: recipient,
    subject: isEmailVerification
      ? "Verify your Book Now Pay Later email"
      : "Your Book Now Pay Later sign-in code",
    type: "AUTHENTICATION_OTP",
    userId: user.id,
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
  });

  if (!result.sent) {
    await prisma.otpChallenge.deleteMany({
      where: { userId: user.id, purpose, codeHash },
    });
    throw new OtpDeliveryError("We couldn't send the verification code. Please try again.");
  }
}

export async function consumeOtp({ userId, purpose, code }) {
  const challenge = await prisma.otpChallenge.findUnique({
    where: { userId_purpose: { userId, purpose } },
  });
  const now = new Date();

  if (!challenge || challenge.expiresAt <= now) {
    return { verified: false, reason: "invalid" };
  }

  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    return { verified: false, reason: "locked" };
  }

  const expectedHash = Buffer.from(hashOtp(userId, purpose, code), "hex");
  const storedHash = Buffer.from(challenge.codeHash, "hex");
  const matches = expectedHash.length === storedHash.length
    && crypto.timingSafeEqual(expectedHash, storedHash);

  if (!matches) {
    await prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        attempts: { lt: MAX_OTP_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    return { verified: false, reason: "invalid" };
  }

  const consumed = await prisma.$transaction(async (tx) => {
    const deleted = await tx.otpChallenge.deleteMany({
      where: {
        id: challenge.id,
        codeHash: challenge.codeHash,
        expiresAt: { gt: now },
        attempts: { lt: MAX_OTP_ATTEMPTS },
      },
    });
    if (deleted.count !== 1) return false;

    if (purpose === "EMAIL_VERIFICATION") {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now },
      });
    }

    return true;
  });

  return consumed
    ? { verified: true }
    : { verified: false, reason: "invalid" };
}
