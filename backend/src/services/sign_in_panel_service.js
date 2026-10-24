// The panel beside the sign-in pages (R6). By default the pages show their own
// animated panel. An admin can replace it with an uploaded image for one of the
// platform's own promotions, limited to a date range; outside it the default
// shows. Only Sign in and Create account show the image: the password pages and
// operator register always keep their own panel (the pages enforce that), and
// the operator surface is always the default. No third-party adverts beside a
// password field, so the panel is never labelled sponsored.

export const SIGN_IN_PANEL_SURFACES = ["customer", "operator"];

export const DEFAULT_SIGN_IN_PANEL = Object.freeze({
  mode: "default",
  imageUrl: null,
  imageAlt: "",
  headline: "",
  linkUrl: null,
  sponsored: false,
  showOn: { customer: true, operator: false },
  startsOn: null,
  endsOn: null,
});

export const SIGN_IN_PANEL_LIMITS = Object.freeze({
  imageAlt: 200,
  headline: 60,
  url: 500,
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, max, label) {
  const result = String(value ?? "").trim();
  if (result.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return result;
}

// An uploaded image is served from the media host (absolute https) or, in
// development, from a same-site path. A link is a page on this site ("/cars")
// or an https address.
function url(value, label, { allowPath = false, httpsOnly = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (raw.length > SIGN_IN_PANEL_LIMITS.url) throw invalid(`${label} is too long.`);
  if (allowPath && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  const refusal = httpsOnly
    ? `${label} must be a page on this site (starting with /) or an https address.`
    : `${label} must be a full http or https address.`;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw invalid(refusal);
  }
  if (parsed.protocol !== "https:" && (httpsOnly || parsed.protocol !== "http:")) throw invalid(refusal);
  return parsed.toString();
}

function day(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!DATE_RE.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw invalid(`${label} must be a date (YYYY-MM-DD).`);
  }
  return raw;
}

// Validate an admin save. Keys left out keep their current value, so a save
// from an older admin page cannot wipe the panel.
export function normalizeSignInPanel(value, current = DEFAULT_SIGN_IN_PANEL) {
  if (value === undefined) return current;
  if (!isPlainObject(value)) throw invalid("Sign-in panel must be a JSON object.");

  const base = { ...DEFAULT_SIGN_IN_PANEL, ...(isPlainObject(current) ? current : {}) };
  const merged = { ...base, ...value };

  const mode = merged.mode === "image" ? "image" : merged.mode === "default" ? "default" : null;
  if (!mode) throw invalid("Sign-in panel mode must be default or image.");

  const panel = {
    mode,
    imageUrl: url(merged.imageUrl, "Panel image", { allowPath: true }),
    imageAlt: text(merged.imageAlt, SIGN_IN_PANEL_LIMITS.imageAlt, "Image description"),
    headline: text(merged.headline, SIGN_IN_PANEL_LIMITS.headline, "Headline"),
    linkUrl: url(merged.linkUrl, "Link", { allowPath: true, httpsOnly: true }),
    // Kept in the stored shape for older saves; always off now (see above).
    sponsored: false,
    showOn: { customer: true, operator: false },
    startsOn: day(merged.startsOn, "Show from"),
    endsOn: day(merged.endsOn, "Show until"),
  };

  if (panel.startsOn && panel.endsOn && panel.endsOn < panel.startsOn) {
    throw invalid("Show until must be on or after Show from.");
  }
  if (panel.mode === "image") {
    if (!panel.imageUrl) throw invalid("Upload an image before switching the panel to a custom image.");
    if (!panel.imageAlt) throw invalid("Describe the image so screen readers can read it out.");
  }
  return panel;
}

// Today's date in Malaysia, which is where the start and end dates are set.
export function malaysiaToday(now = new Date()) {
  return new Date(now.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 10);
}

function forSurface(panel, surface, today) {
  if (surface !== "customer" || panel.mode !== "image" || !panel.imageUrl) return { mode: "default" };
  if (panel.startsOn && today < panel.startsOn) return { mode: "default" };
  if (panel.endsOn && today > panel.endsOn) return { mode: "default" };
  return {
    mode: "image",
    imageUrl: panel.imageUrl,
    imageAlt: panel.imageAlt,
    headline: panel.headline || null,
    linkUrl: panel.linkUrl,
  };
}

// What a signed-out visitor may see, per surface. A stored value that fails
// validation falls back to the default panel rather than breaking sign-in.
export function publicSignInPanel(settings, now = new Date()) {
  let panel;
  try {
    const stored = settings?.signInPanel;
    panel = normalizeSignInPanel(isPlainObject(stored) ? stored : {}, DEFAULT_SIGN_IN_PANEL);
  } catch {
    panel = DEFAULT_SIGN_IN_PANEL;
  }
  const today = malaysiaToday(now);
  return Object.fromEntries(SIGN_IN_PANEL_SURFACES.map((surface) => [surface, forSurface(panel, surface, today)]));
}
