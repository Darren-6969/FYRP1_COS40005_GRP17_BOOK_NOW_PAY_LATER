// Policy library text helpers. Section and template bodies are plain text:
// a blank line separates paragraphs, and a line starting with "- " is a list
// item. Shared by the info pages and the admin Policies and answers page.

/** Body text to blocks: [{ type: "p", text } | { type: "ul", items: [] }]. */
export function parsePolicyBody(body) {
  const blocks = [];
  let list = null;
  for (const raw of String(body || "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (!list) {
        list = { type: "ul", items: [] };
        blocks.push(list);
      }
      list.items.push(line.slice(2).trim());
    } else {
      list = null;
      if (line) blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

const PLACEHOLDER = /\{([a-z0-9_]+)\}/g;

// Same rule as backend/src/utils/policy_text.js; the server check decides.
export function placeholdersIn(body) {
  return [...new Set([...String(body).matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Fill {placeholders} from values; unknown ones are left as they are. */
export function fillPlaceholders(body, values) {
  return String(body).replace(PLACEHOLDER, (whole, name) => (name in values ? values[name] : whole));
}
