import { parsePolicyBody } from "../../utils/policyText";

// Renders policy library text: paragraphs and "- " list items.
export default function PolicyBody({ body, paragraphClassName, listClassName }) {
  return parsePolicyBody(body).map((block, i) =>
    block.type === "ul" ? (
      <ul key={i} className={listClassName}>
        {block.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className={paragraphClassName}>
        {block.text}
      </p>
    )
  );
}
