import { useState } from "react";
import { BRAND } from "../../constants/brand";

// Same rules as passwordSchema in backend/src/validators/auth_validator.js and
// the operator setup check, so the page refuses what the server would refuse.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { id: "lower", label: "A lowercase letter", test: (value) => /[a-z]/.test(value) },
  { id: "number", label: "A number", test: (value) => /[0-9]/.test(value) },
];

// One sentence naming every rule the password still misses, or "".
export function passwordProblem(value) {
  if (!value) return "Enter a password.";
  if (value.length > 128) return "Use 128 characters or fewer.";
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label.toLowerCase());
  if (!missing.length) return "";
  return `The password still needs ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(value) {
  const email = String(value || "").trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_RE.test(email)) return "Enter an email address like name@example.com.";
  return "";
}

// Keeps only the fields that have a problem.
export function onlyProblems(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
}

// Errors for one form: a message at the top (which takes focus) and one per
// field. `attempt` goes up on every failure so the top message is announced
// and scrolled to again, even when its text is unchanged.
export function useFormErrors() {
  const [fields, setFields] = useState({});
  // A problem with the request itself (server refused it, or unreachable).
  const [requestMessage, setRequestMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  const count = Object.keys(fields).length;
  let message = requestMessage;
  if (count) message = count === 1 ? "Check the field marked below." : `Check the ${count} fields marked below.`;

  const fail = (text) => {
    setFields({});
    setRequestMessage(text);
    setAttempt((value) => value + 1);
  };

  // Returns true when every field passed. Otherwise shows the errors.
  const check = (fieldErrors) => {
    const problems = onlyProblems(fieldErrors);
    if (!Object.keys(problems).length) return true;
    setFields(problems);
    setRequestMessage("");
    setAttempt((value) => value + 1);
    return false;
  };

  // The visitor is changing a field: drop its error, and any request message.
  const clearField = (name) => {
    setRequestMessage("");
    setFields((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const clear = () => {
    setFields({});
    setRequestMessage("");
  };

  return { fields, message, attempt, fail, check, clearField, clear };
}

// The message for a failed request. A request that never reached the server is
// not the visitor's fault, so it never says their details are wrong.
export function requestError(err, fallback) {
  if (!err?.response) {
    return `We can't reach ${BRAND.name}${BRAND.suffix} right now. Your details are kept, check your connection and try again.`;
  }
  const data = err.response.data || {};
  return data.errors?.[0]?.message || data.message || data.error || fallback;
}
