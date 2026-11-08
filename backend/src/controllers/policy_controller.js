import {
  createSection,
  getSectionVersions,
  getTemplateVersions,
  listPolicyDocuments,
  listTemplates,
  publishSection,
  publishTemplate,
} from "../services/policy_admin_service.js";
import { getPublishedPolicy } from "../services/policy_service.js";

// ── Admin: Policies and answers ─────────────────────────────────────

// GET /api/policies
export async function getPolicyLibrary(req, res, next) {
  try {
    const [documents, templates] = await Promise.all([listPolicyDocuments(), listTemplates()]);
    res.json({ documents, templates });
  } catch (err) {
    next(err);
  }
}

// GET /api/policies/documents/:documentKey/sections/:sectionKey/versions
export async function getPolicySectionVersions(req, res, next) {
  try {
    res.json({ versions: await getSectionVersions(req.params.documentKey, req.params.sectionKey) });
  } catch (err) {
    next(err);
  }
}

// POST /api/policies/documents/:documentKey/sections
export async function createPolicySection(req, res, next) {
  try {
    const section = await createSection({ documentKey: req.params.documentKey, ...req.body, req });
    res.status(201).json({ section });
  } catch (err) {
    next(err);
  }
}

// POST /api/policies/documents/:documentKey/sections/:sectionKey
export async function publishPolicySection(req, res, next) {
  try {
    const section = await publishSection({
      documentKey: req.params.documentKey,
      sectionKey: req.params.sectionKey,
      ...req.body,
      req,
    });
    res.status(201).json({ section });
  } catch (err) {
    next(err);
  }
}

// GET /api/policies/templates/:key/versions
export async function getAnswerTemplateVersions(req, res, next) {
  try {
    res.json({ versions: await getTemplateVersions(req.params.key) });
  } catch (err) {
    next(err);
  }
}

// POST /api/policies/templates/:key
export async function publishAnswerTemplate(req, res, next) {
  try {
    const template = await publishTemplate({ key: req.params.key, ...req.body, req });
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}

// ── Public ──────────────────────────────────────────────────────────

// GET /api/public/policies/:documentKey (info pages)
export async function getPublicPolicy(req, res, next) {
  try {
    const policy = await getPublishedPolicy(req.params.documentKey);
    if (!policy) return res.status(404).json({ message: "Policy not found", code: "POLICY_NOT_FOUND" });
    res.set("Cache-Control", "public, max-age=60");
    res.json(policy);
  } catch (err) {
    next(err);
  }
}
