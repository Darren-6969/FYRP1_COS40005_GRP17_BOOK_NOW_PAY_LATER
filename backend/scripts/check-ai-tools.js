// Runs the Step 7 test questions against one AI model with the real tools
// and the real database, and prints which tools the model called, with what
// input, and its answer. It goes straight through the model's adapter, so it
// works while the model is switched off and never changes its failure count,
// skip time or the circuit breaker. Read-only: no tool writes anything.
//
//   npm run check:ai-tools -- gpt-6-luna
//   npm run check:ai-tools -- mistral-small-latest --customer=12
//   npm run check:ai-tools -- gpt-6-luna --customer=12 --only=4,9
//
// --customer=ID runs the booking questions as that customer (a test account
// with invented bookings); without it they run as a signed-out visitor.
// --only=4,9 runs just those questions. Each question costs about 6,000 to
// 12,000 tokens, so use --only to save a free plan's daily allowance.

import prisma from "../src/config/db.js";
import { adapterFor } from "../src/services/ai/ai_adapter.js";
import { CALL_TIMEOUT_MS as CHAT_CALL_MS, MAX_OUTPUT_TOKENS } from "../src/services/ai/ai_config.js";
import { classifyAiError } from "../src/services/ai/ai_errors.js";
import { runChatTool } from "../src/services/ai/ai_service.js";
import { chatSystemPrompt } from "../src/services/ai/prompts.js";
import { runToolLoop } from "../src/services/ai/tool_loop.js";
import { TOOL_DEFINITIONS, TOOL_NAMES } from "../src/services/ai/tools/chat_tools.js";
import { klToday } from "../src/services/car_pricing_service.js";

const LIMIT_MS = 20000; // generous; the chat itself allows CALL_TIMEOUT_MS per call
const PAUSE_MS = 3000; // between questions, to stay inside free-plan rate limits

const args = process.argv.slice(2);
const modelName = args.find((a) => !a.startsWith("--"));
const customerArg = args.find((a) => a.startsWith("--customer="));
const customerId = customerArg ? Number(customerArg.split("=")[1]) : null;
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1].split(",").map(Number) : null;

// Test set numbers from the chatbot design doc. Booking questions need --customer.
const QUESTIONS = [
  { n: 1, text: "Which car models are available next Wednesday to Friday?", expect: "search_cars with both dates" },
  { n: 3, text: "I need a 7-seater from the airport on Saturday 9am, returning Monday evening, under RM400", expect: "search_cars: min_seats 7, times, a price limit" },
  { n: 4, text: "How much deposit do I pay for the Honda Civic, and when is the rest due?", expect: "search_cars, then get_car or quote_price: the Civic's deposit and the balance rule" },
  { n: 6, text: "Any Toyota automatic under RM150 a day this weekend?", expect: "search_cars: brand, AUTOMATIC, max_price_per_day 150, weekend dates" },
  { n: 9, text: "Show me booking BK-0000", expect: "visitor: asked to sign in; customer: not found on this account" },
];

function router(model, adapter) {
  return {
    async complete(request) {
      const started = Date.now();
      try {
        const result = await adapter.send({ ...request, model: model.modelName, timeoutMs: LIMIT_MS, signal: AbortSignal.timeout(LIMIT_MS) });
        return { result, model, attempts: [], responseMs: Date.now() - started };
      } catch (err) {
        err.message = `${classifyAiError(err)}: ${err.message}`;
        throw err;
      }
    },
  };
}

if (!modelName) {
  console.log("Name a model: npm run check:ai-tools -- gpt-6-luna");
  process.exitCode = 1;
} else {
  const model = await prisma.aiModel.findFirst({ where: { modelName } });
  const adapter = model ? adapterFor(model.provider) : null;
  if (!model) console.log(`No ai_models row with modelName ${modelName}.`);
  else if (!adapter) console.log(`No API key set for ${model.provider}.`);
  else {
    const today = klToday();
    const ctx = { customerId, carInViewId: null, today };
    const system = chatSystemPrompt({ today, signedIn: Boolean(customerId), carInView: null, toolNames: TOOL_NAMES });
    console.log(`${model.displayName}, today ${today}, ${customerId ? `as customer ${customerId}` : "as a visitor"}`);

    for (const [i, q] of QUESTIONS.filter((x) => !only || only.includes(x.n)).entries()) {
      if (i) await new Promise((r) => setTimeout(r, PAUSE_MS));
      console.log(`\n#${q.n} ${q.text}\n   expected: ${q.expect}`);
      try {
        const out = await runToolLoop({
          router: router(model, adapter),
          system,
          messages: [{ role: "user", text: q.text }],
          tools: TOOL_DEFINITIONS,
          runTool: (call) => runChatTool(call, ctx),
          maxTokens: MAX_OUTPUT_TOKENS,
        });
        if (!out.toolsCalled.length) console.log("   tools: none");
        out.toolsCalled.forEach((t) =>
          console.log(`   round ${t.round}: ${t.name}(${JSON.stringify(t.input)})${t.ok ? "" : `  ✗ ${t.error}`}`)
        );
        console.log(`   answer: ${out.text || "(empty)"}`);
        const each = out.calls.map((c) => `AI ${c.ms} ms${c.toolMs !== undefined ? ` + tools ${c.toolMs} ms` : ""}`).join(", ");
        const slow = out.calls.filter((c) => c.ms > CHAT_CALL_MS).length;
        console.log(`   ${out.responseMs} ms (${each}), ${out.inputTokens} in / ${out.outputTokens} out`);
        if (slow) console.log(`   ⚠ ${slow} AI call${slow > 1 ? "s" : ""} over ${CHAT_CALL_MS} ms: the chat would time out and try the next model`);
      } catch (err) {
        console.log(`   ✗ ${String(err.message).slice(0, 200)}`);
      }
    }
  }
  await prisma.$disconnect();
}
// No process.exit(): on Windows it can trip a libuv assertion while sockets close.
