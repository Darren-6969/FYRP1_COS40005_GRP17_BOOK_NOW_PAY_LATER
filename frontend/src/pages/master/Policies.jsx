import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, ScrollText, MessageSquareText, Plus } from "lucide-react";
import PolicyBody from "../../components/common/PolicyBody";
import {
  createSection,
  getPolicyLibrary,
  getSectionVersions,
  getTemplateVersions,
  publishSection,
  publishTemplate,
} from "../../services/policy_service";
import { fillPlaceholders, placeholdersIn } from "../../utils/policyText";
import "../../assets/styles/master-policies.css";

// Admin console: Policies and answers (SRS 4.5.7). Edits the wording of the
// policy library and the chatbot's fixed answers. Every publish adds a new
// version; earlier versions are kept and listed under Earlier versions.

const DOCUMENT_USE = {
  terms: "Shown on the Terms of service page and quoted by the chatbot.",
  privacy: "Shown on the Privacy and PDPA page and quoted by the chatbot.",
  "refund-rules": "Shown on the Refund rules page and quoted by the chatbot.",
  help: "Help articles the chatbot quotes when it answers a question.",
  "car-faqs": "The “Questions about this car” section on every car page.",
};

const TEMPLATE_INFO = {
  welcome: { name: "Welcome message", when: "The first message when the chat opens." },
  deposit: { name: "Deposits", when: "Quick action, and short questions such as “deposit?”." },
  "deposit.car": { name: "Deposits, car on screen", when: "Used instead of Deposits on a car's page." },
  refunds: { name: "Cancellations and refunds", when: "Quick action, and short questions such as “refund?”." },
  "refunds.car": { name: "Refunds, car on screen", when: "Used instead of Cancellations and refunds on a car's page." },
  "late-return": { name: "Returning late", when: "Quick action, and short questions such as “late return?”." },
  "late-return.car": { name: "Returning late, car on screen", when: "Used instead of Returning late on a car's page." },
  licence: { name: "Driving licence rules", when: "Quick action, and short questions such as “licence?”." },
  duitnow: { name: "Paying by DuitNow", when: "Quick action, and short questions such as “duitnow?”." },
  "booking-status": { name: "My booking status", when: "Signed-in customers; their bookings are listed in place of the placeholder." },
  "payments-due": { name: "Payments due", when: "Signed-in customers; their payments are listed in place of the placeholder." },
  "licence-status": { name: "My licence check", when: "Signed-in customers; their licence tasks are listed in place of the placeholder." },
  "sign-in-needed": { name: "Sign in needed", when: "A signed-out visitor asks about their bookings." },
};

// What each placeholder becomes, and a sample used in the preview.
const PLACEHOLDERS = {
  car_name: { help: "The car on screen", sample: "Perodua Bezza" },
  deposit_percent: { help: "That car's deposit percentage", sample: "30" },
  refund_rule: { help: "That car's refund rule, as a sentence", sample: "the operator keeps the deposit if you cancel." },
  late_hourly_rate: { help: "That car's hourly rate", sample: "RM 15.00" },
  booking_lines: { help: "One line per upcoming booking", sample: "BNPL-0042 · Perodua Bezza, 7 to 9 Nov: Accepted, deposit due" },
  payment_lines: { help: "One line per payment due", sample: "BNPL-0042: RM 105.00 paid, RM 245.00 due by 6 Nov" },
  licence_lines: { help: "One line per licence task", sample: "BNPL-0042: Awaiting the operator's review" },
};

const SAMPLES = Object.fromEntries(Object.entries(PLACEHOLDERS).map(([k, v]) => [k, v.sample]));

function formatDate(value) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function publishedLine(item) {
  const by = item.publishedBy?.name ? ` by ${item.publishedBy.name}` : item.publishedBy === null ? " by the setup script" : "";
  return `Version ${item.version}, published ${formatDate(item.publishedAt)}${by}`;
}

function errorMessage(err, fallback) {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(" ");
  return data?.message || fallback;
}

// ── Earlier versions ────────────────────────────────────────────────

function VersionHistory({ load, currentVersion, onCopy, renderBody }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !versions) {
      try {
        const { data } = await load();
        setVersions(data.versions.filter((v) => v.version !== currentVersion));
      } catch (err) {
        setError(errorMessage(err, "Could not load earlier versions."));
      }
    }
  };

  return (
    <div className="pol-history">
      <button type="button" className="btn" onClick={toggle} aria-expanded={open}>
        <History size={14} aria-hidden="true" /> {open ? "Hide earlier versions" : "Earlier versions"}
      </button>
      {open && (
        <div className="pol-history-list">
          {error && <div className="alert danger">{error}</div>}
          {!versions && !error && <p className="pol-muted">Loading…</p>}
          {versions && !versions.length && <p className="pol-muted">No earlier versions. This is the first one.</p>}
          {versions?.map((v) => (
            <div key={v.version} className="pol-history-item">
              <div className="pol-history-row">
                <span>{publishedLine(v)}</span>
                <span className="actions">
                  <button type="button" className="btn" onClick={() => setShown(shown === v.version ? null : v.version)}>
                    {shown === v.version ? "Hide" : "View"}
                  </button>
                  <button type="button" className="btn" onClick={() => onCopy(v)}>
                    Copy into editor
                  </button>
                </span>
              </div>
              {shown === v.version && <div className="pol-preview pol-preview-old">{renderBody(v)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section editor ──────────────────────────────────────────────────

function SectionEditor({ document, section, onPublished, onDirtyChange }) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = title.trim() !== section.title || body.trim() !== section.body;
  const valid = title.trim() && body.trim();

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const publish = async () => {
    const next = section.version + 1;
    if (!window.confirm(`Publish version ${next} of “${title.trim()}”? Customers see it within a minute, and version ${section.version} is kept.`)) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await publishSection(document.key, section.key, { title, body, baseVersion: section.version });
      onPublished(data.section);
    } catch (err) {
      setError(errorMessage(err, "Could not publish."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pol-editor">
      <div className="pol-editor-head">
        <div>
          <span className="pol-eyebrow">{document.title}</span>
          <h4>{section.title}</h4>
          <p className="pol-muted">{publishedLine(section)}</p>
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}

      <div className="form-group">
        <label htmlFor="pol-title">Section heading</label>
        <input id="pol-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-group">
        <label htmlFor="pol-body">Text</label>
        <textarea id="pol-body" rows={12} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
        <span className="pol-hint">Start a line with “- ” to make it a list item. Leave an empty line between paragraphs.</span>
      </div>

      <div className="pol-preview-label">Preview</div>
      <div className="pol-preview">
        <h5>{title.trim() || "Section heading"}</h5>
        <PolicyBody body={body} />
      </div>

      <div className="pol-editor-actions">
        <button
          type="button"
          className="btn"
          disabled={!dirty || saving}
          onClick={() => {
            setTitle(section.title);
            setBody(section.body);
          }}
        >
          Discard changes
        </button>
        <button type="button" className="btn primary" disabled={!dirty || !valid || saving} onClick={publish}>
          {saving ? "Publishing…" : `Publish as version ${section.version + 1}`}
        </button>
      </div>

      <VersionHistory
        key={section.version}
        currentVersion={section.version}
        load={() => getSectionVersions(document.key, section.key)}
        onCopy={(v) => {
          setTitle(v.title);
          setBody(v.body);
        }}
        renderBody={(v) => (
          <>
            <h5>{v.title}</h5>
            <PolicyBody body={v.body} />
          </>
        )}
      />
    </div>
  );
}

// ── New section ─────────────────────────────────────────────────────

function NewSectionEditor({ document, onCreated, onDirtyChange }) {
  const last = document.sections[document.sections.length - 1];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [afterKey, setAfterKey] = useState(last ? last.key : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = Boolean(title.trim() || body.trim());
  const valid = title.trim() && body.trim();

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const create = async () => {
    if (!window.confirm(`Add “${title.trim()}” to ${document.title}? Customers see it within a minute.`)) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await createSection(document.key, { title, body, afterKey: afterKey || null });
      onCreated(data.section, afterKey || null);
    } catch (err) {
      setError(errorMessage(err, "Could not add the section."));
      setSaving(false);
    }
  };

  return (
    <div className="pol-editor">
      <div className="pol-editor-head">
        <div>
          <span className="pol-eyebrow">{document.title}</span>
          <h4>New section</h4>
          <p className="pol-muted">{DOCUMENT_USE[document.key] || ""}</p>
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}

      <div className="form-group">
        <label htmlFor="pol-new-title">{document.key === "car-faqs" ? "Question" : "Section heading"}</label>
        <input id="pol-new-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-group">
        <label htmlFor="pol-new-body">{document.key === "car-faqs" ? "Answer" : "Text"}</label>
        <textarea id="pol-new-body" rows={10} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
        <span className="pol-hint">Start a line with “- ” to make it a list item. Leave an empty line between paragraphs.</span>
      </div>

      <div className="form-group">
        <label htmlFor="pol-new-position">Position</label>
        <select id="pol-new-position" value={afterKey} onChange={(e) => setAfterKey(e.target.value)}>
          <option value="">At the top</option>
          {document.sections.map((s) => (
            <option key={s.key} value={s.key}>
              After “{s.title}”
            </option>
          ))}
        </select>
      </div>

      <div className="pol-preview-label">Preview</div>
      <div className="pol-preview">
        <h5>{title.trim() || "Section heading"}</h5>
        <PolicyBody body={body} />
      </div>

      <div className="pol-editor-actions">
        <button type="button" className="btn primary" disabled={!valid || saving} onClick={create}>
          {saving ? "Adding…" : "Add section"}
        </button>
      </div>
    </div>
  );
}

// ── Template editor ─────────────────────────────────────────────────

function TemplateEditor({ template, onPublished, onDirtyChange }) {
  const info = TEMPLATE_INFO[template.key] || { name: template.key, when: "" };
  const [label, setLabel] = useState(template.quickActionLabel || "");
  const [keywords, setKeywords] = useState(template.keywords.join(", "));
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);

  const keywordList = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const hasButton = template.quickActionLabel !== null;
  const dirty =
    body.trim() !== template.body ||
    (hasButton && label.trim() !== template.quickActionLabel) ||
    keywordList.join("|") !== template.keywords.join("|");

  const used = placeholdersIn(body);
  const unknown = used.filter((p) => !template.placeholders.includes(p));
  const missing = template.placeholders.filter((p) => p.endsWith("_lines") && !used.includes(p));
  const problems = [
    ...(unknown.length
      ? [`${unknown.map((p) => `{${p}}`).join(", ")} ${unknown.length > 1 ? "are" : "is"} not available in this answer.`]
      : []),
    ...(missing.length ? [`Keep ${missing.map((p) => `{${p}}`).join(", ")}; it is where the customer's details appear.`] : []),
    ...(hasButton && !label.trim() ? ["This answer has a quick action button, so it needs a label."] : []),
    ...(!body.trim() ? ["The answer cannot be empty."] : []),
  ];

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const insert = (name) => {
    const el = bodyRef.current;
    const token = `{${name}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const publish = async () => {
    const next = template.version + 1;
    if (!window.confirm(`Publish version ${next} of “${info.name}”? The chatbot uses it within a minute, and version ${template.version} is kept.`)) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await publishTemplate(template.key, {
        quickActionLabel: hasButton ? label : null,
        keywords: keywordList,
        body,
        baseVersion: template.version,
      });
      onPublished(data.template);
    } catch (err) {
      setError(errorMessage(err, "Could not publish."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pol-editor">
      <div className="pol-editor-head">
        <div>
          <span className="pol-eyebrow">Chatbot answer</span>
          <h4>{info.name}</h4>
          <p className="pol-muted">{info.when}</p>
          <p className="pol-muted">{publishedLine({ ...template, publishedBy: undefined })}</p>
        </div>
        {template.signedInOnly && <span className="badge">Signed-in customers only</span>}
      </div>

      {error && <div className="alert danger">{error}</div>}

      {hasButton && (
        <div className="form-group">
          <label htmlFor="tpl-label">Quick action button</label>
          <input id="tpl-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
        </div>
      )}

      {(hasButton || template.keywords.length > 0) && (
        <div className="form-group">
          <label htmlFor="tpl-keywords">Keywords</label>
          <input id="tpl-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          <span className="pol-hint">
            A message of six words or fewer containing one of these, and naming no car, date or price, gets this answer. Separate them
            with commas.
          </span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="tpl-body">Answer</label>
        <textarea id="tpl-body" ref={bodyRef} rows={7} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
      </div>

      {template.placeholders.length > 0 && (
        <div className="pol-placeholders">
          <span className="pol-hint">Live details you can use. Click to insert at the cursor:</span>
          <div className="pol-chips">
            {template.placeholders.map((p) => (
              <button key={p} type="button" className="pol-chip" onClick={() => insert(p)} title={PLACEHOLDERS[p]?.help}>
                {`{${p}}`}
                {PLACEHOLDERS[p] && <span>{PLACEHOLDERS[p].help}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="alert danger">
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </div>
      )}

      <div className="pol-preview-label">Preview with sample details</div>
      <div className="pol-preview pol-chat">
        {hasButton && label.trim() && <div className="pol-chat-button">{label.trim()}</div>}
        <div className="pol-chat-bubble">{fillPlaceholders(body, SAMPLES)}</div>
      </div>

      <div className="pol-editor-actions">
        <button
          type="button"
          className="btn"
          disabled={!dirty || saving}
          onClick={() => {
            setLabel(template.quickActionLabel || "");
            setKeywords(template.keywords.join(", "));
            setBody(template.body);
          }}
        >
          Discard changes
        </button>
        <button type="button" className="btn primary" disabled={!dirty || problems.length > 0 || saving} onClick={publish}>
          {saving ? "Publishing…" : `Publish as version ${template.version + 1}`}
        </button>
      </div>

      <VersionHistory
        key={template.version}
        currentVersion={template.version}
        load={() => getTemplateVersions(template.key)}
        onCopy={(v) => {
          if (hasButton) setLabel(v.quickActionLabel || "");
          setKeywords(v.keywords.join(", "));
          setBody(v.body);
        }}
        renderBody={(v) => (
          <>
            {v.quickActionLabel && <p className="pol-muted">Button: {v.quickActionLabel}</p>}
            <div className="pol-chat-bubble">{v.body}</div>
          </>
        )}
      />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function Policies() {
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("documents");
  const [selected, setSelected] = useState(null); // "doc:section" or "tpl:key"
  const [notice, setNotice] = useState("");
  const dirtyRef = useRef(false);

  const load = async () => {
    try {
      setError("");
      const { data } = await getPolicyLibrary();
      setLibrary(data);
    } catch (err) {
      setError(errorMessage(err, "Could not load the policy library."));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const confirmLeave = () => !dirtyRef.current || window.confirm("Discard your unpublished changes?");

  const choose = (id) => {
    if (id === selected || !confirmLeave()) return;
    dirtyRef.current = false;
    setNotice("");
    setSelected(id);
  };

  const switchTab = (next) => {
    if (next === tab || !confirmLeave()) return;
    dirtyRef.current = false;
    setTab(next);
    setSelected(null);
    setNotice("");
  };

  const current = useMemo(() => {
    if (!library || !selected) return null;
    const [kind, a, b] = selected.split(":");
    if (kind === "new") {
      const document = library.documents.find((d) => d.key === a);
      return document ? { kind, document } : null;
    }
    if (kind === "doc") {
      const document = library.documents.find((d) => d.key === a);
      const section = document?.sections.find((s) => s.key === b);
      return section ? { kind, document, section } : null;
    }
    const template = library.templates.find((t) => t.key === a);
    return template ? { kind, template } : null;
  }, [library, selected]);

  const onDirtyChange = useCallback((d) => {
    dirtyRef.current = d;
  }, []);

  const sectionPublished = (documentKey, section) => {
    dirtyRef.current = false;
    setLibrary((lib) => ({
      ...lib,
      documents: lib.documents.map((d) =>
        d.key === documentKey
          ? {
              ...d,
              currentVersion: Math.max(d.currentVersion, section.version),
              sections: d.sections.map((s) => (s.key === section.key ? section : s)),
            }
          : d
      ),
    }));
    setNotice(`Published version ${section.version}. Customers see it within a minute.`);
  };

  const sectionCreated = (documentKey, section, afterKey) => {
    dirtyRef.current = false;
    setLibrary((lib) => ({
      ...lib,
      documents: lib.documents.map((d) => {
        if (d.key !== documentKey) return d;
        const at = afterKey === null ? 0 : d.sections.findIndex((s) => s.key === afterKey) + 1;
        return { ...d, sections: [...d.sections.slice(0, at), section, ...d.sections.slice(at)] };
      }),
    }));
    setSelected(`doc:${documentKey}:${section.key}`);
    setNotice(`Added “${section.title}”. Customers see it within a minute.`);
  };

  const templatePublished = (template) => {
    dirtyRef.current = false;
    setLibrary((lib) => ({ ...lib, templates: lib.templates.map((t) => (t.key === template.key ? template : t)) }));
    setNotice(`Published version ${template.version}. The chatbot uses it within a minute.`);
  };

  return (
    <section className="card pol-page">
      <div className="section-header">
        <div>
          <h3>Policies & Answers</h3>
          <p>The wording customers read on the info pages and car pages, and the chatbot&apos;s fixed answers.</p>
        </div>
        <button type="button" className="btn" onClick={() => confirmLeave() && load()}>
          Refresh
        </button>
      </div>

      <div className="pol-rule-note">
        <strong>This changes wording, not rules.</strong> Deposit percentages, what is refunded, deadlines and rates come from the
        system and each operator&apos;s settings. Editing a sentence here does not change what the system does, so keep the meaning
        the same. If a rule itself changes, the system has to change first; then update the wording to match. Every publish is kept
        as a version, so you can always see what customers were shown.
      </div>

      {error && <div className="alert danger">{error}</div>}
      {notice && <div className="alert">{notice}</div>}

      {!library && !error && <div className="empty-state">Loading the policy library…</div>}

      {library && !library.documents.length && !library.templates.length && (
        <div className="empty-state">The policy library is empty. Run npm run seed:chatbot in the backend to load the wording.</div>
      )}

      {library && (library.documents.length > 0 || library.templates.length > 0) && (
        <>
          <div className="pol-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "documents"}
              className={`pol-tab ${tab === "documents" ? "active" : ""}`}
              onClick={() => switchTab("documents")}
            >
              <ScrollText size={16} aria-hidden="true" /> Policies and help
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "templates"}
              className={`pol-tab ${tab === "templates" ? "active" : ""}`}
              onClick={() => switchTab("templates")}
            >
              <MessageSquareText size={16} aria-hidden="true" /> Chatbot answers
            </button>
          </div>

          <div className="pol-layout">
            <nav className="pol-list" aria-label={tab === "documents" ? "Policy sections" : "Chatbot answers"}>
              {tab === "documents" &&
                library.documents.map((doc) => (
                  <div key={doc.key} className="pol-group">
                    <div className="pol-group-title">{doc.title}</div>
                    <div className="pol-group-use">{DOCUMENT_USE[doc.key] || ""}</div>
                    {doc.sections.map((s) => {
                      const id = `doc:${doc.key}:${s.key}`;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          className={`pol-item ${selected === id ? "active" : ""}`}
                          aria-current={selected === id ? "true" : undefined}
                          onClick={() => choose(id)}
                        >
                          <span>{s.title}</span>
                          <span className="pol-item-meta">v{s.version}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`pol-item pol-item-add ${selected === `new:${doc.key}` ? "active" : ""}`}
                      aria-current={selected === `new:${doc.key}` ? "true" : undefined}
                      onClick={() => choose(`new:${doc.key}`)}
                    >
                      <Plus size={14} aria-hidden="true" /> Add section
                    </button>
                  </div>
                ))}

              {tab === "templates" &&
                library.templates.map((t) => {
                  const id = `tpl:${t.key}`;
                  const info = TEMPLATE_INFO[t.key];
                  return (
                    <button
                      key={t.key}
                      type="button"
                      className={`pol-item ${selected === id ? "active" : ""}`}
                      aria-current={selected === id ? "true" : undefined}
                      onClick={() => choose(id)}
                    >
                      <span>{info?.name || t.key}</span>
                      <span className="pol-item-meta">v{t.version}</span>
                    </button>
                  );
                })}
            </nav>

            <div className="pol-main">
              {!current && (
                <div className="empty-state">
                  {tab === "documents" ? "Choose a section to edit its wording." : "Choose an answer to edit it."}
                </div>
              )}
              {current?.kind === "new" && (
                <NewSectionEditor
                  key={current.document.key}
                  document={current.document}
                  onDirtyChange={onDirtyChange}
                  onCreated={(section, afterKey) => sectionCreated(current.document.key, section, afterKey)}
                />
              )}
              {current?.kind === "doc" && (
                <SectionEditor
                  key={`${current.document.key}:${current.section.key}:${current.section.version}`}
                  document={current.document}
                  section={current.section}
                  onDirtyChange={onDirtyChange}
                  onPublished={(section) => sectionPublished(current.document.key, section)}
                />
              )}
              {current?.kind === "tpl" && (
                <TemplateEditor
                  key={`${current.template.key}:${current.template.version}`}
                  template={current.template}
                  onDirtyChange={onDirtyChange}
                  onPublished={templatePublished}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
