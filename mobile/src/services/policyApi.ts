import { apiRequest } from "./api";

export type PolicySection = {
  key: string;
  title: string;
  body: string;
  version: number;
  publishedAt: string;
};

export type PublishedPolicy = {
  key: string;
  title: string;
  version: number;
  sections: PolicySection[];
};

/**
 * A policy from the policy library (GET /public/policies/:key), the same
 * wording the website's /info pages show. Edited on the admin Policies and
 * answers page, so the app never keeps its own copy of the text.
 */
export async function getPublicPolicy(documentKey: string): Promise<PublishedPolicy> {
  return apiRequest(`/public/policies/${encodeURIComponent(documentKey)}`, { method: "GET" });
}
