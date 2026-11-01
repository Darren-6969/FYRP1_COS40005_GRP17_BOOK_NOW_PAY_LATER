import { getToken } from "./session";

export const API_URL =
  "https://api.fypbnplquma.tech/api";

export async function apiRequest(
  path: string,
  options: RequestInit = {}
) {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const requestUrl =
    `${API_URL}${path}`;

  console.log(
    "========== API REQUEST =========="
  );

  console.log(
    "Method:",
    options.method || "GET"
  );

  console.log(
    "URL:",
    requestUrl
  );

  console.log(
    "================================="
  );

  const response = await fetch(
    requestUrl,
    {
      ...options,
      headers,
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    console.log(
      "========== API ERROR =========="
    );

    console.log(
      "Method:",
      options.method || "GET"
    );

    console.log(
      "URL:",
      requestUrl
    );

    console.log(
      "Status:",
      response.status
    );

    console.log(
      "Response:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    console.log(
      "==============================="
    );

    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }

  return data;
}