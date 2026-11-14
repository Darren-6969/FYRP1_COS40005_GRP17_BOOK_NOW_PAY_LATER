// F15: link schemes the mobile app answers to, for Stripe's return links.
//
// "bnplsarawak" is the app's own scheme from the redesign onward. "mobile"
// is the generic scheme of builds already installed by pilot users; it stays
// until no one runs an old build, then it can be removed from this list.
//
// Only listed schemes are ever used, so a checkout request can't point the
// customer's return link at another app.

export const MOBILE_RETURN_SCHEMES = ["bnplsarawak", "mobile"];

// What old builds use, and what a missing or unknown value falls back to.
export const DEFAULT_MOBILE_RETURN_SCHEME = "mobile";

export function mobileReturnScheme(requested) {
  return typeof requested === "string" && MOBILE_RETURN_SCHEMES.includes(requested)
    ? requested
    : DEFAULT_MOBILE_RETURN_SCHEME;
}
