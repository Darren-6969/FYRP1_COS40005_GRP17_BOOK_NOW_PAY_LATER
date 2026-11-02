// Policy library (chatbot design, SRS 4.5.7): the current published wording
// of each policy section. Every version is kept in policy_sections; the
// current one is the highest version of each key. Read by the car detail
// page FAQs now, and by the chatbot's get_policy tool and Layer 1 later.

import prisma from "../config/db.js";

const CACHE_MS = 60 * 1000;
const cache = new Map(); // documentKey -> { at, sections }

/**
 * Current sections of a policy document, in display order:
 * [{ key, title, body, version, publishedAt }]. Empty if the document
 * does not exist yet (for example before the chatbot seed has run).
 */
export async function getPublishedSections(documentKey) {
  const hit = cache.get(documentKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sections;

  const rows = await prisma.policySection.findMany({
    where: { document: { key: documentKey } },
    orderBy: [{ key: "asc" }, { version: "desc" }],
    select: { key: true, title: true, body: true, version: true, sortOrder: true, publishedAt: true },
  });
  const latest = new Map();
  for (const row of rows) if (!latest.has(row.key)) latest.set(row.key, row);
  const sections = [...latest.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ key: s.key, title: s.title, body: s.body, version: s.version, publishedAt: s.publishedAt }));

  cache.set(documentKey, { at: Date.now(), sections });
  return sections;
}

/**
 * A whole document for the public info pages:
 * { key, title, version, sections: [...] }, or null if it does not exist.
 */
export async function getPublishedPolicy(documentKey) {
  const document = await prisma.policyDocument.findUnique({
    where: { key: documentKey },
    select: { key: true, title: true, currentVersion: true },
  });
  if (!document) return null;
  const sections = await getPublishedSections(documentKey);
  return { key: document.key, title: document.title, version: document.currentVersion, sections };
}

// Generic car questions shown on every car detail page, as { q, a }.
// A failed read leaves the section empty rather than failing the page.
export async function getCarFaqs() {
  try {
    const sections = await getPublishedSections("car-faqs");
    return sections.map((s) => ({ q: s.title, a: s.body }));
  } catch (err) {
    console.error("[policy] car FAQs unavailable:", err.message);
    return [];
  }
}

// Call after publishing a new version so the next read sees it.
export function clearPolicyCache(documentKey) {
  if (documentKey) cache.delete(documentKey);
  else cache.clear();
}
