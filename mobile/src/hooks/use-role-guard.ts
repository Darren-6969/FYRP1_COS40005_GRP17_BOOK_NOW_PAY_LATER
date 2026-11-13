import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";

import { ERROR_CODES, isApiError } from "../services/api";
import { getMe } from "../services/authApi";
import {
  clearSession,
  getStoredUser,
  getToken,
  saveStoredUser,
} from "../services/session";
import { logger } from "../utils/logger";

export type AppRole = "CUSTOMER" | "NORMAL_SELLER";

// Cast: the generated route types in .expo/types are stale and miss the
// operator routes (the same error shows in login.tsx today).
const HOME_FOR_ROLE: Record<AppRole, Href> = {
  CUSTOMER: "/customer/home" as Href,
  NORMAL_SELLER: "/operator/dashboard" as Href,
};

// The home screen for a role the mobile app supports, or null.
export function homeForRole(role: unknown): Href | null {
  return typeof role === "string" && role in HOME_FOR_ROLE
    ? HOME_FOR_ROLE[role as AppRole]
    : null;
}

/**
 * F4: lets a section render only for a signed-in user with `required` role.
 *
 * 1. No saved login -> /login.
 * 2. Saved user with another supported role -> that role's home
 *    (an operator opening a customer link lands on the dashboard).
 * 3. Saved user with the right role -> allowed at once, no spinner.
 * 4. Then /auth/me confirms it with the server. An expired access token is
 *    refreshed by api.ts; a dead session is cleared and sent to /login.
 *    No connection or a server error keeps a known user in, so being
 *    offline never logs anyone out. Screens show their own Retry.
 */
export function useRoleGuard(required: AppRole): boolean {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const leave = (target: Href) => {
      if (active) router.replace(target);
    };

    const check = async () => {
      const [token, stored] = await Promise.all([
        getToken(),
        getStoredUser(),
      ]);

      if (!token) return leave("/login");

      const storedHome = homeForRole(stored?.role);
      const storedMatches = stored?.role === required;

      if (storedHome && !storedMatches) return leave(storedHome);
      if (storedMatches && active) setAllowed(true);

      try {
        const response = await getMe();
        const user = response?.user ?? response;
        if (!active) return;

        await saveStoredUser(user);

        if (user?.role === required) {
          setAllowed(true);
          return;
        }

        const home = homeForRole(user?.role);
        if (!home) await clearSession();
        return leave(home ?? "/login");
      } catch (err) {
        // api.ts already cleared the session and went to /login.
        if (isApiError(err) && err.code === ERROR_CODES.SESSION_EXPIRED) {
          return;
        }

        // The server refused this account (e.g. a suspended operator).
        if (isApiError(err) && (err.status === 401 || err.status === 403)) {
          await clearSession();
          return leave("/login");
        }

        // Offline, timed out or a server error: trust the saved role.
        logger.warn("[auth] could not confirm the session", err);
        if (!storedMatches) leave("/login");
      }
    };

    check();

    return () => {
      active = false;
    };
  }, [router, required]);

  return allowed;
}
