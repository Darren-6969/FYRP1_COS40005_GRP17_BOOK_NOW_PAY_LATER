// Estimated cost of one AI call, from the token counts the provider returns
// and the model's prices (USD per million tokens) on its ai_models row. The
// real bill stays in each provider's console.

export function estimateCostUsd(model, inputTokens, outputTokens) {
  const input = Number(model?.priceInput ?? 0);
  const output = Number(model?.priceOutput ?? 0);
  const cost = ((inputTokens || 0) * input + (outputTokens || 0) * output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // the column keeps 6 decimals
}
