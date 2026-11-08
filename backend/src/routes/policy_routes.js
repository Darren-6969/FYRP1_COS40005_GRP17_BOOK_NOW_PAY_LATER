import express from "express";
import {
  createPolicySection,
  getAnswerTemplateVersions,
  getPolicyLibrary,
  getPolicySectionVersions,
  publishAnswerTemplate,
  publishPolicySection,
} from "../controllers/policy_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import { createSectionSchema, publishSectionSchema, publishTemplateSchema } from "../validators/policy_validator.js";

// Admin console: Policies and answers. Platform administrators only.
const router = express.Router();
router.use(verifyToken, allowRoles("MASTER_SELLER"));

router.get("/", getPolicyLibrary);
router.post("/documents/:documentKey/sections", validate(createSectionSchema), createPolicySection);
router.get("/documents/:documentKey/sections/:sectionKey/versions", getPolicySectionVersions);
router.post("/documents/:documentKey/sections/:sectionKey", validate(publishSectionSchema), publishPolicySection);
router.get("/templates/:key/versions", getAnswerTemplateVersions);
router.post("/templates/:key", validate(publishTemplateSchema), publishAnswerTemplate);

export default router;
