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