// Google (Gemini) adapter. See ../ai_adapter.js for the provider-neutral
// shapes.

import { GoogleGenAI } from "@google/genai";

/** Neutral messages → Gemini contents (roles "user" and "model"). */
export function toGoogleContents(messages) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", parts: [{ text: m.text }] };
    if (m.role === "assistant") {
      const parts = [];
      if (m.text) parts.push({ text: m.text });
      (m.toolCalls || []).forEach((c) => parts.push({ functionCall: { id: c.id, name: c.name, args: c.input ?? {} } }));
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
      .map((p, i) => ({ id: p.functionCall.id || makeId(i), name: p.functionCall.name, input: p.functionCall.args ?? {} })),
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
    async send({ model, system, messages, tools = [], maxTokens, signal, timeoutMs }) {
      const res = await client.models.generateContent({
        model,
        contents: toGoogleContents(messages),
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
          abortSignal: signal,
          // No SDK retries: a failed call moves straight on to the next model.
          httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
          ...(tools.length ? { tools: toGoogleTools(tools), automaticFunctionCalling: { disable: true } } : {}),
        },
      });
      return fromGoogleResponse(res);
    },
  };
}
