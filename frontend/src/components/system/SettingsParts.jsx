// Building blocks for the administrator settings page. They render with the
// same operator-* classes as the Operator Settings page so both pages look and
// behave alike.

export function SettingsMenuCard({ icon: Icon, title, description, summary, tone, onOpen }) {
  return (
    <button type="button" className="operator-settings-menu-card" onClick={onOpen}>
      <div className="operator-settings-menu-icon">
        <Icon size={22} />
      </div>

      <div className="operator-settings-menu-text">
        <h3>{title}</h3>
        <p>{description}</p>
        {summary && <span className={`admin-settings-summary ${tone || ""}`}>{summary}</span>}
      </div>

      <span className="operator-settings-arrow">→</span>
    </button>
  );
}

export function SettingsDrawer({ eyebrow, title, description, onClose, footer, children }) {
  return (
    <div className="operator-settings-drawer-backdrop" onClick={onClose}>
      <aside
        className="operator-settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="operator-settings-drawer-head">
          <div>
            <p className="operator-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          <button type="button" className="operator-settings-close" onClick={onClose} aria-label="Close settings panel">
            ×
          </button>
        </div>

        <div className="operator-settings-drawer-body">{children}</div>

        <div className="operator-settings-drawer-footer">{footer}</div>
      </aside>
    </div>
  );
}

export function SettingsSection({ icon, title, description, children }) {
  return (
    <section className="operator-card operator-settings-section">
      <div className="operator-settings-section-head">
        <div className="operator-settings-section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

export function FormField({ label, helper, wide, children }) {
  return (
    <label className="operator-settings-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      {children}
      {helper && <small>{helper}</small>}
    </label>
  );
}

export function ToggleField({ label, helper, checked, onChange }) {
  return (
    <div className="operator-toggle-row">
      <div>
        <strong>{label}</strong>
        {helper && <p>{helper}</p>}
      </div>

      <button
        type="button"
        className={`operator-toggle ${checked ? "active" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
      >
        <span />
      </button>
    </div>
  );
}
