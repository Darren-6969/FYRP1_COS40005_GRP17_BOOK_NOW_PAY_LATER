/**
 * The chatbot's links are website paths (backend/src/services/chat). This
 * turns the ones the app has a screen for into an app route. Anything else
 * opens on the website, so a link added in the admin answers still works.
 */

import type { Href } from "expo-router";

export const WEBSITE_URL = "https://fypbnplquma.tech";

/**
 * Public page where customers and operators ask for their account and data
 * to be deleted (Google Play account deletion requirement). The same URL is
 * entered in the Data safety form in Play Console.
 */
export const ACCOUNT_DELETION_URL = `${WEBSITE_URL}/info/delete-account`;

/** Trip and search keys the car screens read (cars.tsx, car-details.tsx Params). */
const TRIP_KEYS = ["city", "from", "ft", "to", "tt"];

function parseQuery(query: string) {
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [rawKey, rawValue = ""] = pair.split("=");
    try {
      const key = decodeURIComponent(rawKey);
      if (TRIP_KEYS.includes(key)) params[key] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {
      // A malformed pair: skip it.
    }
  }
  return params;
}

export type ChatTarget = { kind: "app"; href: Href } | { kind: "web"; url: string } | null;

export function chatLinkTarget(href: string | null | undefined): ChatTarget {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return { kind: "web", url: href };

  const [path, query = ""] = href.split("?");
  const params = parseQuery(query);
  let match: RegExpMatchArray | null;

  if ((match = path.match(/^\/cars\/(\d+)\/?$/))) {
    return { kind: "app", href: { pathname: "/customer/car-details", params: { id: match[1], ...params } } as unknown as Href };
  }
  if (/^\/cars\/?$/.test(path)) {
    return { kind: "app", href: { pathname: "/customer/cars", params } as unknown as Href };
  }
  if ((match = path.match(/^\/customer\/bookings\/(\d+)\/?$/))) {
    return { kind: "app", href: `/customer/booking/${match[1]}` as Href };
  }
  if (/^\/customer\/bookings\/?$/.test(path)) return { kind: "app", href: "/customer/(tabs)/bookings" as Href };
  if ((match = path.match(/^\/customer\/checkout\/(\d+)\/?$/))) {
    return { kind: "app", href: { pathname: "/customer/checkout", params: { bookingId: match[1] } } as unknown as Href };
  }
  if (/^\/customer\/licence\/?$/.test(path)) return { kind: "app", href: "/customer/licence" as Href };
  if (/^\/customer\/payments\/?$/.test(path)) return { kind: "app", href: "/customer/(tabs)/payments" as Href };
  // The app is already signed in; a sign-in link has nothing to do here.
  if (/^\/login\/?$/.test(path)) return null;

  return { kind: "web", url: `${WEBSITE_URL}${href.startsWith("/") ? "" : "/"}${href}` };
}
