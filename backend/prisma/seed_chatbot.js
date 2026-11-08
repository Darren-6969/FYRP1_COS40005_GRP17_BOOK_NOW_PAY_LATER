// Seeds the chatbot's policy library, Layer 1 answer templates, AI model
// list and AI settings. Safe to run again: it only adds what is missing and
// never touches other tables, unlike prisma/seed.js, which wipes data.
//
//   npm run seed:chatbot              add what is missing
//   npm run seed:chatbot -- --republish
//       also publish the seed wording as a new version wherever it differs
//       from the current version (old versions are kept)
//
// AI models are created switched off, and existing model rows and settings
// are never changed, so choices made on the AI models page survive a rerun.

import { PrismaClient } from "@prisma/client";
import { AI_MODELS, AI_SETTINGS, ANSWER_TEMPLATES, POLICY_DOCUMENTS } from "./seed_data/chatbot.js";

const prisma = new PrismaClient();
const republish = process.argv.includes("--republish");
const counts = { created: 0, republished: 0, kept: 0, edited: 0 };

function latestByKey(rows) {
  const out = new Map();
  for (const row of rows) {
    const seen = out.get(row.key);
    if (!seen || row.version > seen.version) out.set(row.key, row);
  }
  return out;
}

async function seedPolicies() {
  for (const doc of POLICY_DOCUMENTS) {
    const document = await prisma.policyDocument.upsert({
      where: { key: doc.key },
      create: { key: doc.key, title: doc.title, audience: doc.audience, currentVersion: 1 },
      update: {},
    });
    const current = latestByKey(await prisma.policySection.findMany({ where: { documentId: document.id } }));

    for (const [i, section] of doc.sections.entries()) {
      const have = current.get(section.key);
      const data = { title: section.title, body: section.body, sortOrder: i };
      if (!have) {
        await prisma.policySection.create({ data: { documentId: document.id, key: section.key, version: 1, ...data } });
        counts.created += 1;
      } else if (have.title === section.title && have.body === section.body) {
        counts.kept += 1;
      } else if (republish) {
        await prisma.policySection.create({ data: { documentId: document.id, key: section.key, version: have.version + 1, ...data } });
        counts.republished += 1;
      } else {
        console.log(`  kept edited section ${doc.key}.${section.key} (v${have.version}); use --republish to replace it`);
        counts.edited += 1;
      }
    }

    // The document's version is the highest version of any of its sections.
    const top = await prisma.policySection.aggregate({ where: { documentId: document.id }, _max: { version: true } });
    await prisma.policyDocument.update({ where: { id: document.id }, data: { currentVersion: top._max.version || 1 } });
  }
}

async function seedTemplates() {
  const current = latestByKey(await prisma.chatAnswerTemplate.findMany());
  for (const [i, t] of ANSWER_TEMPLATES.entries()) {
    const have = current.get(t.key);
    const data = {
      quickActionLabel: t.quickActionLabel,
      keywords: t.keywords,
      placeholders: t.placeholders,
      body: t.body,
      signedInOnly: Boolean(t.signedInOnly),
      sortOrder: i,
    };
    if (!have) {
      await prisma.chatAnswerTemplate.create({ data: { key: t.key, version: 1, ...data } });
      counts.created += 1;
    } else if (
      have.body === t.body &&
      have.quickActionLabel === t.quickActionLabel &&
      have.signedInOnly === data.signedInOnly &&
      have.keywords.join("|") === t.keywords.join("|") &&
      have.placeholders.join("|") === t.placeholders.join("|")
    ) {
      counts.kept += 1;
    } else if (republish) {
      await prisma.chatAnswerTemplate.create({ data: { key: t.key, version: have.version + 1, ...data } });
      counts.republished += 1;
    } else {
      console.log(`  kept edited template ${t.key} (v${have.version}); use --republish to replace it`);
      counts.edited += 1;
    }
  }
}

async function seedAi() {
  for (const m of AI_MODELS) {
    const exists = await prisma.aiModel.findUnique({
      where: { provider_modelName: { provider: m.provider, modelName: m.modelName } },
    });
    if (exists) {
      counts.kept += 1;
      continue;
    }
    await prisma.aiModel.create({ data: { ...m, enabled: false, plan: "FREE" } });
    counts.created += 1;
  }

  const settings = await prisma.aiSettings.findUnique({ where: { id: 1 } });
  if (settings) {
    counts.kept += 1;
  } else {
    await prisma.aiSettings.create({ data: { id: 1, ...AI_SETTINGS } });
    counts.created += 1;
  }
}

async function main() {
  await seedPolicies();
  await seedTemplates();
  await seedAi();
  const summary = `created ${counts.created}, unchanged ${counts.kept}, republished ${counts.republished}, edited and kept ${counts.edited}`;
  console.log(`Chatbot seed done: ${summary}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
