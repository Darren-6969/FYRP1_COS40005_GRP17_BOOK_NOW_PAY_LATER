// Policies and answers editor (admin console, SRS 4.5.7). Publishing never
// edits a row's wording: it adds the next version, so every earlier version
// stays and a dispute can show exactly what a customer saw. Adding a section
// moves the sections after it down one place, which updates sortOrder on
// every version of those sections; position is not wording.
//
// This changes WORDING only. The rules themselves (deposit %, refund
// outcomes, deadlines, rates) live in code and operator settings; numbers
// reach templates through {placeholders} filled at answer time.

import prisma from "../config/db.js";
import { createAuditLog } from "./log_service.js";
import { clearPolicyCache } from "./policy_service.js";
import { missingRequiredPlaceholders, orderWithInsert, sectionKeyFor, unknownPlaceholders } from "../utils/policy_text.js";

function httpError(statusCode, message, appCode, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  Object.assign(err, extra);
  return err;
}

function latestByKey(rows) {
  const out = new Map();
  for (const row of rows) {
    const seen = out.get(row.key);
    if (!seen || row.version > seen.version) out.set(row.key, row);
  }
  return out;
}

const publisherSelect = { select: { id: true, name: true, email: true } };

// ── Policy documents ────────────────────────────────────────────────

export async function listPolicyDocuments() {
  const documents = await prisma.policyDocument.findMany({
    orderBy: { id: "asc" },
    include: { sections: { include: { publishedBy: publisherSelect } } },
  });
  return documents.map((doc) => {
    const current = [...latestByKey(doc.sections).values()].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      key: doc.key,
      title: doc.title,
      audience: doc.audience,
      currentVersion: doc.currentVersion,
      sections: current.map((s) => ({
        key: s.key,
        title: s.title,
        body: s.body,
        version: s.version,
        publishedAt: s.publishedAt,
        publishedBy: s.publishedBy,
      })),
    };
  });
}

async function findDocument(documentKey, tx = prisma) {
  const document = await tx.policyDocument.findUnique({ where: { key: documentKey } });
  if (!document) throw httpError(404, "Policy document not found", "POLICY_NOT_FOUND");
  return document;
}

export async function getSectionVersions(documentKey, sectionKey) {
  const document = await findDocument(documentKey);
  const versions = await prisma.policySection.findMany({
    where: { documentId: document.id, key: sectionKey },
    orderBy: { version: "desc" },
    include: { publishedBy: publisherSelect },
  });
  if (!versions.length) throw httpError(404, "Policy section not found", "POLICY_SECTION_NOT_FOUND");
  return versions.map((v) => ({
    version: v.version,
    title: v.title,
    body: v.body,
    publishedAt: v.publishedAt,
    publishedBy: v.publishedBy,
  }));
}

/**
 * Publish new wording for an existing section as the next version.
 * baseVersion is the version the admin started editing from; if someone
 * published in the meantime the request is refused rather than overwriting.
 */
export async function publishSection({ documentKey, sectionKey, title, body, baseVersion, req }) {
  const result = await prisma.$transaction(async (tx) => {
    const document = await findDocument(documentKey, tx);
    const current = await tx.policySection.findFirst({
      where: { documentId: document.id, key: sectionKey },
      orderBy: { version: "desc" },
    });
    if (!current) throw httpError(404, "Policy section not found", "POLICY_SECTION_NOT_FOUND");
    if (baseVersion !== current.version) {
      throw httpError(409, `Someone published version ${current.version} while you were editing. Reload to see it.`, "POLICY_VERSION_CONFLICT");
    }
    if (current.title === title && current.body === body) {
      throw httpError(400, "Nothing has changed since the current version.", "POLICY_UNCHANGED");
    }

    const created = await tx.policySection.create({
      data: {
        documentId: document.id,
        key: sectionKey,
        title,
        body,
        sortOrder: current.sortOrder,
        version: current.version + 1,
        publishedById: req.user.id,
      },
      include: { publishedBy: publisherSelect },
    });
    const top = await tx.policySection.aggregate({ where: { documentId: document.id }, _max: { version: true } });
    await tx.policyDocument.update({ where: { id: document.id }, data: { currentVersion: top._max.version } });

    await createAuditLog(
      {
        req,
        action: "POLICY_SECTION_PUBLISHED",
        entityType: "PolicySection",
        entityId: created.id,
        before: { version: current.version, title: current.title, body: current.body },
        after: { version: created.version, title: created.title, body: created.body },
        details: { documentKey, sectionKey },
      },
      tx
    );
    return created;
  }, { maxWait: 10_000, timeout: 20_000 });

  clearPolicyCache(documentKey);
  return {
    key: result.key,
    title: result.title,
    body: result.body,
    version: result.version,
    publishedAt: result.publishedAt,
    publishedBy: result.publishedBy,
  };
}

/**
 * Add a new section to a document as version 1, after afterKey (null puts
 * it at the top). The key is made from the heading and never reused.
 */
export async function createSection({ documentKey, title, body, afterKey, req }) {
  const result = await prisma.$transaction(async (tx) => {
    const document = await findDocument(documentKey, tx);
    // One add at a time per document, so two admins adding at once cannot
    // end up with the same position.
    await tx.$queryRaw`SELECT "id" FROM "policy_documents" WHERE "id" = ${document.id} FOR UPDATE`;

    const rows = await tx.policySection.findMany({ where: { documentId: document.id } });
    const current = [...latestByKey(rows).values()].sort((a, b) => a.sortOrder - b.sortOrder);
    const key = sectionKeyFor(title, current.map((s) => s.key));
    const order = orderWithInsert(current.map((s) => s.key), key, afterKey);
    if (!order) {
      throw httpError(409, "The section you chose to add after no longer exists. Reload and try again.", "POLICY_SECTION_NOT_FOUND");
    }

    // Renumber 0..n so the new section has a free place, in one statement:
    // a query per section is too many round trips for the transaction.
    await tx.$executeRaw`
      UPDATE "policy_sections" AS s
      SET "sortOrder" = o.ord - 1
      FROM unnest(${order}::text[]) WITH ORDINALITY AS o(key, ord)
      WHERE s."documentId" = ${document.id} AND s."key" = o.key AND s."sortOrder" <> o.ord - 1`;

    const created = await tx.policySection.create({
      data: {
        documentId: document.id,
        key,
        title,
        body,
        sortOrder: order.indexOf(key),
        version: 1,
        publishedById: req.user.id,
      },
      include: { publishedBy: publisherSelect },
    });

    await createAuditLog(
      {
        req,
        action: "POLICY_SECTION_CREATED",
        entityType: "PolicySection",
        entityId: created.id,
        before: null,
        after: { key, title, body, position: created.sortOrder + 1 },
        details: { documentKey, afterKey },
      },
      tx
    );
    return created;
  }, { maxWait: 10_000, timeout: 20_000 });

  clearPolicyCache(documentKey);
  return {
    key: result.key,
    title: result.title,
    body: result.body,
    version: result.version,
    publishedAt: result.publishedAt,
    publishedBy: result.publishedBy,
  };
}

// ── Chatbot answer templates ────────────────────────────────────────

function templateDto(t) {
  return {
    key: t.key,
    quickActionLabel: t.quickActionLabel,
    keywords: t.keywords,
    placeholders: t.placeholders,
    body: t.body,
    signedInOnly: t.signedInOnly,
    version: t.version,
    publishedAt: t.publishedAt,
  };
}

export async function listTemplates() {
  const rows = await prisma.chatAnswerTemplate.findMany();
  return [...latestByKey(rows).values()].sort((a, b) => a.sortOrder - b.sortOrder).map(templateDto);
}

export async function getTemplateVersions(key) {
  const versions = await prisma.chatAnswerTemplate.findMany({ where: { key }, orderBy: { version: "desc" } });
  if (!versions.length) throw httpError(404, "Answer template not found", "TEMPLATE_NOT_FOUND");
  return versions.map(templateDto);
}

/**
 * Publish new wording for a template as the next version. The allowed
 * placeholders and who sees it are fixed by the code that fills the
 * template, so they carry over unchanged and cannot be edited here.
 */
export async function publishTemplate({ key, quickActionLabel, keywords, body, baseVersion, req }) {
  const created = await prisma.$transaction(async (tx) => {
    const current = await tx.chatAnswerTemplate.findFirst({ where: { key }, orderBy: { version: "desc" } });
    if (!current) throw httpError(404, "Answer template not found", "TEMPLATE_NOT_FOUND");
    if (baseVersion !== current.version) {
      throw httpError(409, `Someone published version ${current.version} while you were editing. Reload to see it.`, "TEMPLATE_VERSION_CONFLICT");
    }

    const unknown = unknownPlaceholders(body, current.placeholders);
    if (unknown.length) {
      throw httpError(
        400,
        `This answer can only use ${current.placeholders.length ? current.placeholders.map((p) => `{${p}}`).join(", ") : "no placeholders"}. Remove ${unknown.map((p) => `{${p}}`).join(", ")}.`,
        "TEMPLATE_UNKNOWN_PLACEHOLDER",
        { details: { unknown } }
      );
    }
    // A template whose live list is its whole point must keep it.
    const missing = missingRequiredPlaceholders(body, current.placeholders);
    if (missing.length) {
      throw httpError(400, `Keep ${missing.map((p) => `{${p}}`).join(", ")} in this answer; it is where the customer's details appear.`, "TEMPLATE_MISSING_PLACEHOLDER");
    }

    // A quick action stays a quick action; an answer without a button stays without one.
    const label = current.quickActionLabel === null ? null : quickActionLabel;
    if (current.quickActionLabel !== null && !label) {
      throw httpError(400, "This answer has a quick action button, so it needs a button label.", "TEMPLATE_LABEL_REQUIRED");
    }
    const unchanged =
      current.body === body &&
      current.quickActionLabel === label &&
      current.keywords.join("|") === keywords.join("|");
    if (unchanged) throw httpError(400, "Nothing has changed since the current version.", "TEMPLATE_UNCHANGED");

    const row = await tx.chatAnswerTemplate.create({
      data: {
        key,
        quickActionLabel: label,
        keywords,
        placeholders: current.placeholders,
        body,
        signedInOnly: current.signedInOnly,
        sortOrder: current.sortOrder,
        version: current.version + 1,
      },
    });
    await createAuditLog(
      {
        req,
        action: "CHAT_TEMPLATE_PUBLISHED",
        entityType: "ChatAnswerTemplate",
        entityId: row.id,
        before: { version: current.version, quickActionLabel: current.quickActionLabel, keywords: current.keywords, body: current.body },
        after: { version: row.version, quickActionLabel: row.quickActionLabel, keywords: row.keywords, body: row.body },
        details: { key },
      },
      tx
    );
    return row;
  }, { maxWait: 10_000, timeout: 20_000 });
  return templateDto(created);
}
