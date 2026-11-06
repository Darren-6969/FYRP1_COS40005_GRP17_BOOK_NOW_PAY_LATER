// Google (Gemini) adapter. See ../ai_adapter.js for the provider-neutral
// shapes.
//
// Thought signatures: Gemini 3 models return a thoughtSignature with their
// function calls, and reject the next request (400) unless each call goes
// back with its signature, exactly as returned. fromGoogleResponse keeps it
// on the neutral tool call, and toGoogleContents puts it back. A call made by
// another model (the router switched mid-message) has no signature, so the
// first call of that turn gets Google's documented bypass value instead.

import { GoogleGenAI } from "@google/genai";

export const SKIP_SIGNATURE = "skip_thought_signature_validator";

// The SDK sends httpOptions.timeout to Google as a server deadline, and
// Google refuses anything under 10 seconds (400 "Minimum allowed deadline is
// 10s"). The chat's own 5-second limit is enforced by the router's abort
// signal, so Google only needs a deadline it accepts.
export const GOOGLE_MIN_DEADLINE_MS = 10000;

/** The deadline sent to Google for a call the router limits to timeoutMs. */
export function googleDeadline(timeoutMs) {
  return Math.max(timeoutMs || 0, GOOGLE_MIN_DEADLINE_MS);
}

/** Neutral messages → Gemini contents (roles "user" and "model"). */
export function toGoogleContents(messages) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", parts: [{ text: m.text }] };
    if (m.role === "assistant") {
      const parts = [];
      if (m.text) parts.push({ text: m.text });
      const calls = m.toolCalls || [];
      // Gemini signs only the first of parallel calls; if none came from
      // Gemini, that first call needs the bypass value.
      const signed = calls.some((c) => c.thoughtSignature);
      calls.forEach((c, i) => {
        const signature = c.thoughtSignature || (!signed && i === 0 ? SKIP_SIGNATURE : null);
        parts.push({ functionCall: { id: c.id, name: c.name, args: c.input ?? {} }, ...(signature ? { thoughtSignature: signature } : {}) });
      });
      return { role: "model", parts: parts.length ? parts : [{ text: "" }] };
    }
    return {
      role: "user",
      parts: m.results.map((r) => ({ functionResponse: { id: r.id, name: r.name, response: r.isError ? { error: r.output } : { result: r.output } } })),
    };
  });
}

export function toGoogleTools(tools) {
  return [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }];
}

/** Gemini reply → { text, toolCalls, inputTokens, outputTokens, finishReason }. */
export function fromGoogleResponse(res, makeId = (i) => `call_${Date.now().toString(36)}_${i}`) {
  const parts = res?.candidates?.[0]?.content?.parts || [];
  const usage = res?.usageMetadata || {};
  return {
    text: parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim(),
    toolCalls: parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({
        id: p.functionCall.id || makeId(i),
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
        ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}),
      })),
    inputTokens: usage.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    finishReason: res?.candidates?.[0]?.finishReason || null,
  };
}

export function createGoogleAdapter(apiKey) {
  const client = new GoogleGenAI({ apiKey });
  return {
    provider: "GOOGLE",
    async send({ model, system, messages, tools = [], toolChoice, maxTokens, signal, timeoutMs }) {
      const res = await client.models.generateContent({
        model,
        contents: toGoogleContents(messages),
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingLevel: "LOW" },
          abortSignal: signal,
          // No SDK retries: a failed call moves straight on to the next model.
          httpOptions: { timeout: googleDeadline(timeoutMs), retryOptions: { attempts: 1 } },
          ...(tools.length
            ? {
                tools: toGoogleTools(tools),
                automaticFunctionCalling: { disable: true },
                ...(toolChoice === "none" ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
              }
            : {}),
        },
      });
      return fromGoogleResponse(res);
    },
  };
}
