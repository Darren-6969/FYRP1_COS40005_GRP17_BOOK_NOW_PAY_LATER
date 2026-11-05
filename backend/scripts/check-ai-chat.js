// Sends two small test requests to every AI model row, straight through its
// adapter, to check the model ID, the reply shape and the tool-call round
// trip before a model is switched on. It does not change any model's failure
// count or skip time, and costs a few hundred tokens per model.
//
//   npm run check:ai-chat                  every model row
//   npm run check:ai-chat -- gpt-6-luna    one model, by modelName

import prisma from "../src/config/db.js";
import { adapterFor } from "../src/services/ai/ai_adapter.js";
import { CALL_TIMEOUT_MS } from "../src/services/ai/ai_config.js";
import { classifyAiError } from "../src/services/ai/ai_errors.js";

const LIMIT_MS = 20000; // generous here; anything over CALL_TIMEOUT_MS is flagged
const only = process.argv[2] || null;

const TOOL = {
  name: "get_platform_time",
  description: "Returns the platform's current time. Call it whenever the customer asks for the time.",
  parameters: { type: "object", properties: { timezone: { type: "string", description: "IANA time zone" } }, required: ["timezone"] },
};
const SYSTEM = "You are a test assistant. Follow the instructions exactly and keep answers under ten words.";

async function timed(fn) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMIT_MS);
  try {
    const result = await fn(controller.signal);
    return { result, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function speed(ms) {
  return ms > CALL_TIMEOUT_MS ? `${ms} ms  ⚠ over the ${CALL_TIMEOUT_MS} ms limit the chat uses` : `${ms} ms`;
}

async function check(model) {
  const adapter = adapterFor(model.provider);
  console.log(`\n${model.displayName} (${model.provider}, ${model.modelName}, ${model.enabled ? "on" : "off"})`);
  if (!adapter) {
    console.log("  - no API key set for this provider");
    return true;
  }
  const base = { model: model.modelName, system: SYSTEM, maxTokens: 300, timeoutMs: LIMIT_MS };
  try {
    const plain = await timed((signal) => adapter.send({ ...base, signal, messages: [{ role: "user", text: "Reply with the single word OK." }] }));
    console.log(`  ✓ text: "${plain.result.text}"  ${speed(plain.ms)}, ${plain.result.inputTokens} in / ${plain.result.outputTokens} out`);

    const ask = [{ role: "user", text: "What time is it in Kuching? Use the tool." }];
    const first = await timed((signal) => adapter.send({ ...base, signal, tools: [TOOL], messages: ask }));
    const call = first.result.toolCalls[0];
    if (!call) {
      console.log(`  ✗ tool call: the model answered in text instead ("${first.result.text}")`);
      return false;
    }
    console.log(`  ✓ tool call: ${call.name}(${JSON.stringify(call.input)})  ${speed(first.ms)}`);

    const second = await timed((signal) =>
      adapter.send({
        ...base,
        signal,
        tools: [TOOL],
        messages: [
          ...ask,
          { role: "assistant", text: first.result.text, toolCalls: first.result.toolCalls },
          { role: "tool", results: [{ id: call.id, name: call.name, output: { time: "14:05", timezone: "Asia/Kuching" } }] },
        ],
      })
    );
    const usedResult = second.result.text.includes("14:05") || second.result.text.includes("2:05");
    console.log(`  ${usedResult ? "✓" : "?"} tool result used: "${second.result.text}"  ${speed(second.ms)}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${classifyAiError(err)}: ${String(err.message).slice(0, 200)}`);
    return false;
  }
}

const models = await prisma.aiModel.findMany({ orderBy: { position: "asc" } });
const picked = only ? models.filter((m) => m.modelName === only) : models;
if (!picked.length) {
  console.log(only ? `No ai_models row with modelName ${only}.` : "No ai_models rows. Run npm run seed:chatbot first.");
  process.exit(1);
}
let failed = 0;
for (const model of picked) if (!(await check(model))) failed += 1;
await prisma.$disconnect();
// process.exit() while sockets are still closing trips a libuv assertion on
// Windows; set the code and let Node exit on its own.
process.exitCode = failed ? 1 : 0;
