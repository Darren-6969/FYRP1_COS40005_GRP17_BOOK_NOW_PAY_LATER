// Shared numeric-id parser for route params. Throws a 400-tagged error on bad input.
export function parseId(value, label = "id") {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}