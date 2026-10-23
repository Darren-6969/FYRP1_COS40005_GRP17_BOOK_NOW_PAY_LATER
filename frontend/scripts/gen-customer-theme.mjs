// One-off generator for R5 (car rental refresh): moves the customer area
// onto the public site's colour tokens without touching the operator and
// admin pages.
//
// customer.css is imported globally from main.jsx and also styles the
// operator Shop settings and admin System settings pages, so its colours
// cannot be edited in place. Instead this script:
//   1. removes the rules for the old customer sidebar and top bar, which no
//      layout renders after R5 (only when the class is used nowhere else);
//   2. writes src/assets/styles/customer-theme.css: for every rule in
//      customer.css and car-offer-card.css, a copy scoped under
//      .customer-theme (the customer layout's root) holding only its colour
//      declarations, each colour mapped to a --pub-* token by family and role.
//
// Run from frontend/: node scripts/gen-customer-theme.mjs
// Needs postcss (npm i -D postcss). Re-run after changing customer.css.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import postcss from "postcss";

const STYLES = "src/assets/styles";
const SOURCES = [`${STYLES}/customer.css`, `${STYLES}/car-offer-card.css`];
const OUT = `${STYLES}/customer-theme.css`;
const SCOPE = ".customer-theme";

// ── 1. dead shell rules ────────────────────────────────────────────────
// Class prefixes of the old sidebar and top bar. A class with one of these
// prefixes is dead only when no .jsx or .js file uses it any more.
const DEAD_PREFIXES = [
  "customer-shell", "customer-main", "customer-sidebar", "customer-topbar",
  "topbar-scroll-mode", "topbar-show", "topbar-hide", "customer-brand",
  "customer-nav-", "customer-mobile-menu", "customer-bottom-nav",
  "customer-profile-chip", "customer-avatar", "customer-notification-",
  "customer-bell-icon", "customer-menu-open",
];

const sourceText = execSync(
  `grep -rhoE --include=*.jsx --include=*.js "[A-Za-z0-9_-]+" src`,
  { maxBuffer: 64 * 1024 * 1024 }
).toString();
const usedTokens = new Set(sourceText.split("\n"));
const usedInJsx = (cls) => usedTokens.has(cls);

const classesIn = (sel) => [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
const isDeadClass = (cls) => DEAD_PREFIXES.some((p) => cls.startsWith(p)) && !usedInJsx(cls);
const deadClasses = new Set();
const isDeadSelector = (sel) => {
  const dead = classesIn(sel).filter(isDeadClass);
  dead.forEach((c) => deadClasses.add(c));
  return dead.length > 0;
};

// ── 2. colour mapping ──────────────────────────────────────────────────
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

function parse(c) {
  c = c.toLowerCase().replace(/\s+/g, "");
  if (c === "white") return [255, 255, 255, 1];
  if (c === "black") return [0, 0, 0, 1];
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((x) => x + x).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const p = c.slice(c.indexOf("(") + 1, -1).split(",").map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
}

function family([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const sat = max - min;
  // Tailwind's slate greys lean blue (#64748b, #94a3b8); below this spread
  // they read as grey, so they map to ink, text and label, not the brand.
  if (sat < 50) return { fam: "neutral", light };
  if (b > r && b >= g - 10) return { fam: "blue", light };
  if (g > r && g > b) return { fam: "green", light };
  if (r > g && g > b + 25) return { fam: "amber", light };
  if (r > g && r > b) return { fam: "red", light };
  return { fam: "neutral", light };
}

const mix = (token, a) =>
  a >= 0.999 ? `var(${token})` : `color-mix(in srgb, var(${token}) ${Math.round(a * 100)}%, transparent)`;

// role: text | bg | border | shadow
function mapColor(raw, role) {
  const [r, g, b, a] = parse(raw);
  const { fam, light } = family([r, g, b]);

  if (role === "shadow") {
    if (fam === "blue") return `rgba(30, 79, 68, ${a})`;
    if (light > 200) return raw; // inset highlights stay as they were
    return `rgba(20, 35, 31, ${a})`;
  }

  if (fam === "neutral") {
    if (role === "text") {
      if (light > 200) return "var(--pub-on-brand)";
      if (light < 60) return "var(--pub-ink)";
      if (light < 100) return "var(--pub-text)";
      return "var(--pub-label)";
    }
    if (role === "border") return light > 215 ? mix("--pub-line", Math.max(a, 0.9)) : "var(--pub-control-line)";
    // A faint white wash over a coloured control (a count chip on the
    // active tab) stays a wash; glassy whites become the flat surface.
    if (light >= 246 && a < 0.5) return raw;
    if (light >= 246) return "var(--pub-surface)";
    if (light >= 200) return "var(--pub-surface-sunk)";
    if (light < 60) return mix("--pub-ink", a);
    return mix("--pub-label", a);
  }

  if (fam === "blue") {
    if (light >= 225) {
      // pale blue tints: info badges and selected wells
      if (role === "border") return "var(--pub-line)";
      if (role === "text") return "var(--pub-on-brand)";
      return light >= 240 ? "var(--pub-surface-sunk)" : "var(--pub-ok-bg)";
    }
    if (role === "text") return "var(--pub-link)";
    return mix("--pub-brand", a);
  }

  const pair = { green: "ok", amber: "warn", red: "error" }[fam];
  if (role === "text") return light > 200 ? "var(--pub-on-brand)" : `var(--pub-${pair}-fg)`;
  if (role === "border") return light > 160 ? mix(`--pub-${pair}-fg`, 0.3) : `var(--pub-${pair}-fg)`;
  return light > 160 ? mix(`--pub-${pair}-bg`, Math.max(a, 0.9)) : mix(`--pub-${pair}-fg`, a);
}

function roleOf(prop) {
  if (/shadow/.test(prop)) return "shadow";
  if (/^(border|outline)/.test(prop)) return "border";
  if (/^background/.test(prop)) return "bg";
  if (/^(color|fill|stroke|caret-color|-webkit-text-fill-color|text-decoration-color|accent-color)$/.test(prop)) return "text";
  return null;
}

// ── run ────────────────────────────────────────────────────────────────
const customerPath = SOURCES[0];
const customerRoot = postcss.parse(fs.readFileSync(customerPath, "utf8"));
let removed = 0;
customerRoot.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
  const sels = rule.selectors;
  const live = sels.filter((s) => !isDeadSelector(s));
  if (live.length === sels.length) return;
  removed += sels.length - live.length;
  if (live.length) rule.selectors = live;
  else rule.remove();
});
customerRoot.walkAtRules("media", (at) => {
  if (!at.nodes.length) at.remove();
});
fs.writeFileSync(customerPath, customerRoot.toString());

const out = postcss.root();
let rules = 0;
for (const file of SOURCES) {
  const src = file === customerPath ? customerRoot : postcss.parse(fs.readFileSync(file, "utf8"));
  src.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
    const decls = [];
    rule.each((d) => {
      if (d.type !== "decl") return;
      const role = roleOf(d.prop);
      if (!role || !COLOR_RE.test(d.value)) return;
      COLOR_RE.lastIndex = 0;
      decls.push(d.clone({ value: d.value.replace(COLOR_RE, (c) => mapColor(c, role)), raws: { before: "\n  ", between: ": " } }));
    });
    COLOR_RE.lastIndex = 0;
    if (!decls.length) return;
    const selectors = rule.selectors
      .filter((s) => !/^(html|body|:root)\b/.test(s.trim()))
      .map((s) => `${SCOPE} ${s.trim()}`);
    if (!selectors.length) return;
    const scoped = postcss.rule({ selectors, raws: { between: " ", after: "\n" } });
    decls.forEach((d) => scoped.append(d));
    let target = out;
    if (rule.parent?.type === "atrule") {
      const at = rule.parent;
      target = postcss.atRule({ name: at.name, params: at.params, raws: { afterName: " ", between: " ", after: "\n" } });
      out.append(target);
    }
    target.append(scoped);
    rules += 1;
  });
}

const header = `/*
 * GENERATED by scripts/gen-customer-theme.mjs, do not edit by hand.
 * The customer area's colours on the public tokens (R5): each rule from
 * customer.css and car-offer-card.css, scoped under ${SCOPE} with only its
 * colour declarations. customer.css stays global for the operator and admin
 * pages that also use it; these rules apply inside the customer layout only.
 */
`;
fs.writeFileSync(OUT, header + out.toString().replace(/\n{3,}/g, "\n\n") + "\n");
console.log(`removed ${removed} dead selectors (${deadClasses.size} classes), wrote ${rules} scoped rules to ${path.basename(OUT)}`);
