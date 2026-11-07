// Checks the chatbot's AI provider keys without spending tokens: each provider
// is asked for its model list, which is free. Prints the model IDs each key can
// see, so the exact IDs for the admin AI models page can be copied from here.
// Usage: npm run check:ai-keys

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import env from "../src/config/env.js";
import { MISTRAL_BASE_URL } from "../src/services/ai/adapters/openai_adapter.js";

const MATCH = {
  openai: /^gpt/i,
  google: /flash/i,
  mistral: /small|medium/i,
};

async function openaiModels(apiKey) {
  const client = new OpenAI({ apiKey });
  const ids = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids;
}

async function googleModels(apiKey) {
  const client = new GoogleGenAI({ apiKey });
  const ids = [];
  const pager = await client.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) ids.push(String(m.name).replace(/^models\//, ""));
  return ids;
}

async function mistralModels(apiKey) {
  const client = new OpenAI({ apiKey, baseURL: MISTRAL_BASE_URL });
  const ids = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids;
}

const PROVIDERS = [
  ["openai", "OPENAI_API_KEY", openaiModels],
  ["google", "GEMINI_API_KEY", googleModels],
  ["mistral", "MISTRAL_API_KEY", mistralModels],
];

let failed = 0;
for (const [name, envName, list] of PROVIDERS) {
  const key = env.AI_KEYS[name];
  if (!key) {
    console.log(`- ${name}: no ${envName} set, models off`);
    continue;
  }
  try {
    const ids = (await list(key)).filter((id) => MATCH[name].test(id)).sort();
    console.log(`✓ ${name}: key works. ${ids.length} matching models:`);
    ids.forEach((id) => console.log(`    ${id}`));
  } catch (err) {
    failed += 1;
    console.log(`✗ ${name}: ${String(err.message).slice(0, 200)}`);
  }
}
process.exit(failed ? 1 : 0);
