// Generic Zod validation middleware – OWASP A03 2025 (Injection / bad input)
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({ message: "Validation failed", errors });
    }

    // Replace req.body with the coerced, sanitised output from Zod
    req.body = result.data;
    next();
  };
}
