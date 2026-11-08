// Helpers for policy and answer template text, kept free of database access
// so they can be unit tested. The admin page has a copy of placeholdersIn in
// frontend/src/utils/policyText.js for its live check; the server check here
// is the one that decides.

const PLACEHOLDER = /\{([a-z0-9_]+)\}/g;

/** Placeholder names used in a template body, without duplicates. */
export function placeholdersIn(body) {
  return [...new Set([...String(body).matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Placeholders in body that the template does not allow. */
export function unknownPlaceholders(body, allowed) {
  return placeholdersIn(body).filter((name) => !allowed.includes(name));
}

/** Allowed placeholders the body must keep: the live lists (…_lines). */
export function missingRequiredPlaceholders(body, allowed) {
  const used = placeholdersIn(body);
  return allowed.filter((p) => p.endsWith("_lines") && !used.includes(p));
}

/**
 * Key for a new policy section, made from its heading ("Late returns" ->
 * "late-returns"). taken holds every key the document has ever used, so a
 * key is never reused, even for a section with the same heading.
 */
export function sectionKeyFor(title, taken) {
  const base =
    String(title)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "section";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Section keys in display order with newKey inserted after afterKey, or at
 * the top when afterKey is null. Null if afterKey is not in the list.
 */
export function orderWithInsert(keys, newKey, afterKey) {
  if (afterKey === null) return [newKey, ...keys];
  const at = keys.indexOf(afterKey);
  if (at === -1) return null;
  return [...keys.slice(0, at + 1), newKey, ...keys.slice(at + 1)];
}
