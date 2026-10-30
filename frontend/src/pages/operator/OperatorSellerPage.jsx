// Seller Page editor (Module 6, BNPLB-133, SRS 4.2.7 / FR-CUST-007).
// The operator owner edits their public page at /o/:slug here: the link
// name, cover photo, about text, year started, languages, and each branch's
// phone and opening hours. Saving sends only what changed to
// PATCH /operators/storefront; the live page reads the same fields.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  ImageUp,
  X,
} from "lucide-react";
import { operatorService } from "../../services/operator_service";
import "../../assets/styles/operator-seller-page.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Same rules as operator_storefront_service.js, so most mistakes show while typing.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;
const RESERVED_SLUGS = ["new", "edit", "admin", "api", "operator", "operators", "settings"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ABOUT_MAX = 2000;
const LANGUAGES_MAX = 8;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Where each API error code belongs on the page.
const FIELD_FOR_CODE = {
  SLUG_INVALID: "slug",
  SLUG_TAKEN: "slug",
  ABOUT_TOO_LONG: "about",
  YEAR_INVALID: "year",
  LANGUAGES_INVALID: "languages",
  COVER_INVALID: "cover",
  HOURS_INVALID: "branches",
  BRANCH_NOT_FOUND: "branches",
};

const FIELD_ANCHOR = {
  slug: "seller-slug",
  cover: "seller-cover",
  about: "seller-about",
  year: "seller-year",
  languages: "seller-language-input",
  branches: "seller-branches",
};

function toForm(data) {
  return {
    slug: data?.slug || "",
    about: data?.about || "",
    coverImageUrl: data?.coverImageUrl || null,
    establishedYear: data?.establishedYear ? String(data.establishedYear) : "",
    languages: Array.isArray(data?.languages) ? data.languages : [],
    branches: (data?.branches || []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      city: branch.city || "",
      isActive: branch.isActive !== false,
      phone: branch.phone || "",
      hours: (branch.hours || []).map((day) => ({
        closed: Boolean(day.closed),
        open: day.open || "",
        close: day.close || "",
      })),
    })),
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function changedSections(form, initial) {
  if (!form || !initial) return [];
  const sections = [];
  if (form.slug !== initial.slug) sections.push("link");
  if (form.coverImageUrl !== initial.coverImageUrl) sections.push("cover");
  if (
    form.about !== initial.about ||
    form.establishedYear !== initial.establishedYear ||
    !sameJson(form.languages, initial.languages)
  ) {
    sections.push("about");
  }
  if (!sameJson(form.branches, initial.branches)) sections.push("branches");
  return sections;
}

function buildPayload(form, initial) {
  const payload = {};
  if (form.slug !== initial.slug) payload.slug = form.slug.trim();
  if (form.coverImageUrl !== initial.coverImageUrl) payload.coverImageUrl = form.coverImageUrl;
  if (form.about !== initial.about) payload.about = form.about;
  if (form.establishedYear !== initial.establishedYear) {
    payload.establishedYear = form.establishedYear === "" ? null : Number(form.establishedYear);
  }
  if (!sameJson(form.languages, initial.languages)) payload.languages = form.languages;

  const branches = form.branches
    .map((branch, index) => {
      const before = initial.branches[index];
      const patch = { id: branch.id };
      if (branch.phone !== before.phone) patch.phone = branch.phone;
      if (!sameJson(branch.hours, before.hours)) {
        patch.weeklyHours = branch.hours.map((day) =>
          day.closed ? { closed: true } : { closed: false, open: day.open, close: day.close }
        );
      }
      return Object.keys(patch).length > 1 ? patch : null;
    })
    .filter(Boolean);
  if (branches.length) payload.branches = branches;

  return payload;
}

function slugProblem(slug) {
  if (RESERVED_SLUGS.includes(slug)) return "That name is reserved. Pick another one.";
  if (!SLUG_RE.test(slug)) {
    return "Use 3 to 50 lowercase letters, numbers and dashes. Start and end with a letter or number.";
  }
  return null;
}

// Checks run before saving. Returns { field: message }, branch problems keyed by id.
function validate(form, initial) {
  const errors = {};
  const sections = changedSections(form, initial);

  if (sections.includes("link")) {
    const problem = slugProblem(form.slug);
    if (problem) errors.slug = problem;
  }
  if (form.about.length > ABOUT_MAX) {
    errors.about = `Keep the description under ${ABOUT_MAX.toLocaleString("en-US")} characters.`;
  }
  if (form.establishedYear !== "") {
    const year = Number(form.establishedYear);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) {
      errors.year = "Enter the year the business started, for example 2014.";
    }
  }

  const branchErrors = {};
  form.branches.forEach((branch, index) => {
    if (sameJson(branch.hours, initial.branches[index]?.hours)) return;
    const badDay = branch.hours.findIndex(
      (day) => !day.closed && (!HHMM.test(day.open) || !HHMM.test(day.close) || day.open >= day.close)
    );
    if (badDay !== -1) {
      branchErrors[branch.id] = `${DAYS[badDay]}: enter an opening time before the closing time, or mark it closed.`;
    }
  });
  if (Object.keys(branchErrors).length) errors.branchHours = branchErrors;

  return errors;
}

function branchSummary(branch) {
  const openDays = branch.hours.filter((day) => !day.closed);
  if (openDays.length === 0) return "Closed every day";
  if (openDays.some((day) => !day.open || !day.close)) return "Opening hours not set";
  const first = openDays[0];
  const sameEveryDay = openDays.every((day) => day.open === first.open && day.close === first.close);
  const days = openDays.length === 7 ? "Open 7 days" : `Open ${openDays.length} days a week`;
  return sameEveryDay ? `${days}, ${first.open} to ${first.close}` : days;
}

function initials(name) {
  return String(name || "")
    .replace(/\s*(sdn\.?\s*bhd\.?|bhd\.?|enterprise)\s*$/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function joinLanguages(list) {
  if (list.length <= 1) return list[0] || "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export default function OperatorSellerPage() {
  const [profile, setProfile] = useState(null);
  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [languageDraft, setLanguageDraft] = useState("");
  const [expandedBranch, setExpandedBranch] = useState(null);
  const [upload, setUpload] = useState(null);
  const [coverError, setCoverError] = useState("");

  const coverInputRef = useRef(null);
  const summaryRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await operatorService.getStorefront();
      const next = toForm(data);
      setProfile({ companyName: data.companyName, logoUrl: data.logoUrl });
      setInitial(next);
      setForm(next);
      setExpandedBranch(next.branches[0]?.id ?? null);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "We could not load your seller page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const sections = useMemo(() => changedSections(form, initial), [form, initial]);
  const dirty = sections.length > 0;

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (summary.length && summaryRef.current) summaryRef.current.focus();
  }, [summary]);

  // An edit clears the error shown on that field; the next save checks again.
  const update = (patch, clears = []) => {
    setForm((current) => ({ ...current, ...patch }));
    setSaved(false);
    if (clears.length) {
      setErrors((current) => {
        const next = { ...current };
        clears.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const updateBranch = (branchId, change) => {
    setForm((current) => ({
      ...current,
      branches: current.branches.map((branch) => (branch.id === branchId ? change(branch) : branch)),
    }));
    setSaved(false);
  };

  const updateDay = (branchId, dayIndex, patch) =>
    updateBranch(branchId, (branch) => ({
      ...branch,
      hours: branch.hours.map((day, i) => (i === dayIndex ? { ...day, ...patch } : day)),
    }));

  const copyMondayToAll = (branchId) =>
    updateBranch(branchId, (branch) => ({
      ...branch,
      hours: branch.hours.map(() => ({ ...branch.hours[0] })),
    }));

  const addLanguage = () => {
    const value = languageDraft.trim().replace(/,$/, "").trim();
    setLanguageDraft("");
    if (!value || form.languages.length >= LANGUAGES_MAX) return;
    if (form.languages.some((lang) => lang.toLowerCase() === value.toLowerCase())) return;
    update({ languages: [...form.languages, value] });
  };

  const removeLanguage = (name) => update({ languages: form.languages.filter((lang) => lang !== name) });

  const publicPath = initial?.slug ? `/o/${initial.slug}` : null;
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : "";

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const field = document.createElement("textarea");
      field.value = publicUrl;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const chooseCover = () => coverInputRef.current?.click();

  const handleCoverFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCoverError("");
    if (!COVER_TYPES.includes(file.type)) {
      setCoverError(`${file.name} is not a PNG, JPG or WebP photo.`);
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setCoverError(`${file.name} is ${mb} MB. Use a photo up to 5 MB.`);
      return;
    }

    setUpload({ name: file.name, percent: 0 });
    try {
      const { data } = await operatorService.uploadCoverImage(file, (progress) => {
        if (!progress.total) return;
        setUpload({ name: file.name, percent: Math.round((progress.loaded / progress.total) * 100) });
      });
      update({ coverImageUrl: data.url });
      setErrors((current) => ({ ...current, cover: undefined }));
    } catch (err) {
      setCoverError(err?.response?.data?.message || "The photo did not upload. Try again.");
    } finally {
      setUpload(null);
    }
  };

  const discard = () => {
    setForm(initial);
    setErrors({});
    setSummary([]);
    setCoverError("");
    setLanguageDraft("");
  };

  const save = async () => {
    const problems = validate(form, initial);
    if (Object.keys(problems).length) {
      setErrors(problems);
      setSummary(
        Object.entries(problems).flatMap(([field, message]) =>
          field === "branchHours"
            ? Object.entries(message).map(([branchId, text]) => ({
                anchor: `seller-branch-${branchId}`,
                text: `${form.branches.find((b) => String(b.id) === branchId)?.name}: ${text}`,
              }))
            : [{ anchor: FIELD_ANCHOR[field], text: message }]
        )
      );
      const firstBranch = problems.branchHours && Object.keys(problems.branchHours)[0];
      if (firstBranch) setExpandedBranch(Number(firstBranch));
      return;
    }

    setSaving(true);
    setErrors({});
    setSummary([]);
    try {
      const { data } = await operatorService.updateStorefront(buildPayload(form, initial));
      const next = toForm(data);
      setInitial(next);
      setForm(next);
      setProfile({ companyName: data.companyName, logoUrl: data.logoUrl });
      setSaved(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || "Your changes were not saved. Try again.";
      const field = FIELD_FOR_CODE[code];
      if (field) setErrors({ [field]: message });
      setSummary([{ anchor: field ? FIELD_ANCHOR[field] : null, text: message }]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="operator-page seller-editor" aria-busy="true">
        <div className="seller-editor-skeleton head" />
        <div className="seller-editor-layout">
          <div className="seller-editor-form">
            <div className="seller-editor-skeleton card" />
            <div className="seller-editor-skeleton card tall" />
          </div>
          <div className="seller-editor-skeleton preview" />
        </div>
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="operator-page seller-editor">
        <div className="operator-alert warning">
          {loadError || "We could not load your seller page."}
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const slugError = errors.slug || (form.slug !== initial.slug ? slugProblem(form.slug) : null);
  const aboutTooLong = form.about.length > ABOUT_MAX;
  const canSave = dirty && !saving && !upload;
  const firstParagraph = form.about.split(/\n{2,}/)[0]?.trim();
  const city = form.branches.find((b) => b.isActive && b.city)?.city;
  const metaLine = [city, form.establishedYear && `since ${form.establishedYear}`].filter(Boolean).join(", ");
  const changedLabel = saved
    ? "All changes saved"
    : dirty
      ? `${sections.length} ${sections.length === 1 ? "section" : "sections"} changed`
      : "No changes yet";

  return (
    <div className="operator-page seller-editor">
      <section className="operator-page-head seller-editor-head">
        <div>
          <p className="operator-eyebrow">Your business</p>
          <h1>Seller Page</h1>
          <p>Your public page with every published car. Share the link with customers.</p>
        </div>

        <div className="seller-editor-head-actions">
          <button type="button" className="seller-editor-btn outline" onClick={copyLink} disabled={!publicUrl}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy link"}
          </button>
          {publicPath && (
            <a className="seller-editor-btn soft" href={publicPath} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              View my page
            </a>
          )}
        </div>
      </section>

      {summary.length > 0 && (
        <div
          ref={summaryRef}
          className="seller-editor-summary"
          role="alert"
          tabIndex={-1}
          aria-labelledby="seller-summary-title"
        >
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <h2 id="seller-summary-title">Nothing was saved. Fix this and save again.</h2>
            <ul>
              {summary.map((item) => (
                <li key={item.text}>
                  {item.anchor ? <a href={`#${item.anchor}`}>{item.text}</a> : item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {saved && (
        <div className="seller-editor-saved" role="status" aria-live="polite">
          <Check size={18} aria-hidden="true" />
          Saved. Your seller page shows the changes now.
        </div>
      )}

      <div className="seller-editor-layout">
        <div className="seller-editor-form">
          <section className="seller-editor-card" aria-labelledby="seller-link-title">
            <div className="seller-editor-card-head">
              <h2 id="seller-link-title">Page link</h2>
              <p>Share this on WhatsApp, Facebook or your business card.</p>
            </div>

            <div className="seller-editor-field">
              <label htmlFor="seller-slug">Link name</label>
              <div className={`seller-editor-slug ${slugError ? "invalid" : ""}`}>
                <span>{window.location.host}/o/</span>
                <input
                  id="seller-slug"
                  value={form.slug}
                  onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }, ["slug"])}
                  aria-invalid={Boolean(slugError)}
                  aria-describedby="seller-slug-help"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p id="seller-slug-help" className={slugError ? "seller-editor-error" : "seller-editor-help"}>
                {slugError || "Lowercase letters, numbers and dashes."}
              </p>
            </div>

            {initial.slug && form.slug !== initial.slug && !slugError && (
              <p className="seller-editor-warning">
                Changing the link stops the old one from working. Links you have already shared will
                show a not found page.
              </p>
            )}
          </section>

          <section className="seller-editor-card" aria-labelledby="seller-cover-title">
            <div className="seller-editor-card-head">
              <h2 id="seller-cover-title">Cover photo</h2>
              <p>Runs across the top of your page. A wide photo of your cars or shopfront works best.</p>
            </div>

            <div className="seller-editor-cover-row">
              <div className="seller-editor-cover-thumb">
                {form.coverImageUrl ? (
                  <img src={form.coverImageUrl} alt="Current cover photo" />
                ) : (
                  <span>No cover photo yet</span>
                )}
              </div>

              <div className="seller-editor-cover-actions">
                <div className="seller-editor-row">
                  <button
                    id="seller-cover"
                    type="button"
                    className="seller-editor-btn soft"
                    onClick={chooseCover}
                    disabled={Boolean(upload)}
                  >
                    <ImageUp size={16} />
                    {form.coverImageUrl ? "Replace cover" : "Upload cover"}
                  </button>
                  {form.coverImageUrl && (
                    <button
                      type="button"
                      className="seller-editor-btn plain"
                      onClick={() => update({ coverImageUrl: null })}
                      disabled={Boolean(upload)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="seller-editor-hidden"
                  onChange={handleCoverFile}
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {upload && (
                  <div className="seller-editor-progress" role="status">
                    <div aria-hidden="true">
                      <span style={{ width: `${upload.percent}%` }} />
                    </div>
                    Uploading {upload.name}, {upload.percent}%
                  </div>
                )}

                {(coverError || errors.cover) && (
                  <p className="seller-editor-error" role="alert">
                    {coverError || errors.cover}
                  </p>
                )}

                <p className="seller-editor-help">
                  PNG, JPG or WebP, up to 5 MB. Your logo comes from{" "}
                  <Link to="/operator/profile">Profile</Link>.
                </p>
              </div>
            </div>
          </section>

          <section className="seller-editor-card" aria-labelledby="seller-about-title">
            <div className="seller-editor-card-head">
              <h2 id="seller-about-title">About your business</h2>
              <p>Tell customers who you are. A blank line starts a new paragraph.</p>
            </div>

            <div className="seller-editor-field">
              <div className="seller-editor-label-row">
                <label htmlFor="seller-about">About</label>
                <span className={aboutTooLong ? "seller-editor-error" : "seller-editor-help"} aria-live="polite">
                  {form.about.length.toLocaleString("en-US")} / {ABOUT_MAX.toLocaleString("en-US")}
                </span>
              </div>
              <textarea
                id="seller-about"
                rows={7}
                value={form.about}
                onChange={(e) => update({ about: e.target.value }, ["about"])}
                aria-invalid={Boolean(errors.about) || aboutTooLong}
                aria-describedby={errors.about ? "seller-about-error" : undefined}
              />
              {errors.about && (
                <p id="seller-about-error" className="seller-editor-error">
                  {errors.about}
                </p>
              )}
            </div>

            <div className="seller-editor-about-grid">
              <div className="seller-editor-field">
                <label htmlFor="seller-year">Year started</label>
                <input
                  id="seller-year"
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={form.establishedYear}
                  onChange={(e) => update({ establishedYear: e.target.value }, ["year"])}
                  aria-invalid={Boolean(errors.year)}
                  aria-describedby={errors.year ? "seller-year-error" : undefined}
                />
                {errors.year && (
                  <p id="seller-year-error" className="seller-editor-error">
                    {errors.year}
                  </p>
                )}
              </div>

              <div className="seller-editor-field">
                <div className="seller-editor-label-row">
                  <label htmlFor="seller-language-input">Languages spoken</label>
                  <span className="seller-editor-help">
                    {form.languages.length} of {LANGUAGES_MAX}
                  </span>
                </div>
                <div className="seller-editor-chips">
                  {form.languages.map((lang) => (
                    <span key={lang} className="seller-editor-chip">
                      {lang}
                      <button type="button" onClick={() => removeLanguage(lang)} aria-label={`Remove ${lang}`}>
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {form.languages.length < LANGUAGES_MAX && (
                    <input
                      id="seller-language-input"
                      value={languageDraft}
                      onChange={(e) => setLanguageDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addLanguage();
                        }
                      }}
                      onBlur={addLanguage}
                      placeholder="Type and press Enter"
                      aria-describedby="seller-language-help"
                    />
                  )}
                </div>
                <p id="seller-language-help" className={errors.languages ? "seller-editor-error" : "seller-editor-help"}>
                  {errors.languages || "For example English, Bahasa Melayu or Mandarin."}
                </p>
              </div>
            </div>
          </section>

          <section id="seller-branches" className="seller-editor-card" aria-labelledby="seller-branches-title">
            <div className="seller-editor-card-head">
              <h2 id="seller-branches-title">Branches and opening hours</h2>
              <p>
                Shown on each branch card. Add or rename branches in{" "}
                <Link to="/operator/branches">Branches</Link>.
              </p>
            </div>

            {errors.branches && <p className="seller-editor-error">{errors.branches}</p>}

            {form.branches.length === 0 && (
              <p className="seller-editor-empty">
                You have no branches yet. <Link to="/operator/branches">Add a branch</Link> so customers
                know where to pick up.
              </p>
            )}

            {form.branches.map((branch) => {
              const open = expandedBranch === branch.id;
              const hoursError = errors.branchHours?.[branch.id];
              return (
                <div key={branch.id} id={`seller-branch-${branch.id}`} className="seller-editor-branch">
                  <button
                    type="button"
                    className={`seller-editor-branch-head ${open ? "open" : ""}`}
                    onClick={() => setExpandedBranch(open ? null : branch.id)}
                    aria-expanded={open}
                    aria-controls={`seller-branch-body-${branch.id}`}
                  >
                    <span>
                      <strong>
                        {branch.name}
                        {!branch.isActive && <em> (inactive)</em>}
                      </strong>
                      <small>{branchSummary(branch)}</small>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>

                  {open && (
                    <div id={`seller-branch-body-${branch.id}`} className="seller-editor-branch-body">
                      <div className="seller-editor-field narrow">
                        <label htmlFor={`seller-phone-${branch.id}`}>Branch phone</label>
                        <input
                          id={`seller-phone-${branch.id}`}
                          type="tel"
                          maxLength={30}
                          value={branch.phone}
                          onChange={(e) => updateBranch(branch.id, (b) => ({ ...b, phone: e.target.value }))}
                        />
                      </div>

                      <div className="seller-editor-label-row">
                        <span className="seller-editor-label">Opening hours</span>
                        <button
                          type="button"
                          className="seller-editor-btn small"
                          onClick={() => copyMondayToAll(branch.id)}
                        >
                          Copy Monday to all days
                        </button>
                      </div>

                      {hoursError && (
                        <p className="seller-editor-error" role="alert">
                          {hoursError}
                        </p>
                      )}

                      <div className="seller-editor-hours">
                        {branch.hours.map((day, index) => (
                          <div key={DAYS[index]} className="seller-editor-day">
                            <span className="seller-editor-day-name">{DAYS[index]}</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!day.closed}
                              aria-label={`${DAYS[index]} open`}
                              className={`seller-editor-switch ${day.closed ? "" : "on"}`}
                              onClick={() => updateDay(branch.id, index, { closed: !day.closed })}
                            >
                              <span aria-hidden="true" />
                              {day.closed ? "Closed" : "Open"}
                            </button>
                            {day.closed ? (
                              <span className="seller-editor-help">Customers see this day as closed.</span>
                            ) : (
                              <div className="seller-editor-times">
                                <input
                                  type="time"
                                  value={day.open}
                                  onChange={(e) => updateDay(branch.id, index, { open: e.target.value })}
                                  aria-label={`${DAYS[index]} opens`}
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={day.close}
                                  onChange={(e) => updateDay(branch.id, index, { close: e.target.value })}
                                  aria-label={`${DAYS[index]} closes`}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="seller-editor-preview" aria-labelledby="seller-preview-title">
          <h2 id="seller-preview-title">How customers see it</h2>
          <div className="seller-editor-preview-card">
            <div className="seller-editor-preview-cover">
              {form.coverImageUrl ? <img src={form.coverImageUrl} alt="" /> : <span>No cover photo</span>}
            </div>
            <div className="seller-editor-preview-body">
              <div className="seller-editor-preview-logo">
                {profile?.logoUrl ? (
                  <img src={profile.logoUrl} alt="" />
                ) : (
                  <span aria-hidden="true">{initials(profile?.companyName)}</span>
                )}
              </div>
              <div>
                <p className="seller-editor-preview-name">{profile?.companyName}</p>
                {metaLine && <p className="seller-editor-help">{metaLine}</p>}
              </div>
              <p className="seller-editor-preview-about">
                {firstParagraph || "Add a short description so customers know who you are."}
              </p>
              {form.languages.length > 0 && (
                <p className="seller-editor-help">Speaks {joinLanguages(form.languages)}</p>
              )}
              <p className="seller-editor-preview-link">
                {window.location.host}/o/{form.slug || "your-link"}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="seller-editor-savebar">
        <span className={dirty && !saved ? "seller-editor-dirty" : "seller-editor-help"} aria-live="polite">
          {changedLabel}
        </span>
        <div className="seller-editor-row">
          <button type="button" className="operator-secondary-btn" onClick={discard} disabled={!dirty || saving}>
            Discard
          </button>
          <button type="button" className="operator-primary-btn" onClick={save} disabled={!canSave}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
