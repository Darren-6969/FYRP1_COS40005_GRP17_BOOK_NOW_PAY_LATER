import { apiRequest } from "./api";

export async function loginUser(
  email: string,
  password: string
) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

/** Operator two-step sign-in: the code emailed after the password. Returns the session. */
export async function verifyLoginCode(email: string, code: string) {
  return apiRequest("/auth/verify-login-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

/** Confirms a new account's email with the code sent at sign-up (or at sign-in). */
export async function verifyEmailCode(email: string, code: string) {
  return apiRequest("/auth/verify-email-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      privacyPolicyAccepted: true,
      termsAccepted: true,
    }),
  });
}

export async function getMe() {
  return apiRequest("/auth/me", {
    method: "GET",
  });
}

export async function updateProfile(input: {
  name: string;
  phone: string;
  profileImageUrl: string;
}) {
  return apiRequest("/auth/profile", {
    method: "PATCH",

    body: JSON.stringify({
      name: input.name,
      phone: input.phone,
      profileImageUrl:
        input.profileImageUrl,
    }),
  });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest("/auth/change-password", {
    method: "PATCH",
    body: JSON.stringify({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      confirmPassword: input.confirmPassword,
    }),
  });
}

export async function updateNotificationPreferences(input: {
  notifyBookingUpdates: boolean;
  notifyPaymentReminders: boolean;
  notifyInvoices: boolean;
  notifyPromotions: boolean;
}) {
  return apiRequest("/auth/notification-preferences", {
    method: "PATCH",

    body: JSON.stringify({
      notifyBookingUpdates:
        input.notifyBookingUpdates,

      notifyPaymentReminders:
        input.notifyPaymentReminders,

      notifyInvoices:
        input.notifyInvoices,

      notifyPromotions:
        input.notifyPromotions,
    }),
  });
}