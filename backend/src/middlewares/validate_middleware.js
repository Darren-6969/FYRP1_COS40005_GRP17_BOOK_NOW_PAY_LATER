// Generic Zod validation middleware – OWASP A03 2025 (Injection / bad input)
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodIssues = result.error.issues || result.error.errors || [];

      const errors = zodIssues.map((e) => ({
        field: Array.isArray(e.path) ? e.path.join(".") : "",
        message: e.message,
      }));

      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    req.body = result.data;
    next();
  };
}