import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getSystemLogs } from "../../services/admin_service";

const PAGE_SIZES = [25, 50, 100];

const ACTORS = [
  { value: "", label: "Anyone" },
  { value: "SYSTEM", label: "System" },
  { value: "MASTER_SELLER", label: "Administrators" },
  { value: "NORMAL_SELLER", label: "Operators" },
  { value: "CUSTOMER", label: "Customers" },
];

const ROLE_LABEL = {
  MASTER_SELLER: "Admin",
  NORMAL_SELLER: "Operator",
  CUSTOMER: "Customer",
};

// Filters the page keeps in the address bar, so a filtered view can be
// bookmarked or sent to a teammate.
const FILTER_KEYS = ["q", "action", "entityType", "actor", "from", "to"];

function dateTime(value) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function klToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
}

function klDaysAgo(days) {
  const date = new Date(`${klToday()}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(date);
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return value !== "";
}

export default function SystemLogs() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || ""]));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 25;

  const [search, setSearch] = useState(filters.q);
  const [data, setData] = useState({ items: [], total: 0, facets: { actions: [], entityTypes: [] } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const queryString = params.toString();

  // Any filter change goes back to page 1.
  const update = (changes, { keepPage = false } = {}) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === "" || value === null || value === undefined) next.delete(key);
          else next.set(key, String(value));
        }
        if (!keepPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  // Search waits until typing pauses so every keystroke is not a request.
  useEffect(() => {
    if (search.trim() === filters.q) return undefined;
    const timer = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setOpenId(null);

    const request = Object.fromEntries(new URLSearchParams(queryString));
    getSystemLogs({ ...request, page, pageSize })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Couldn't load the logs. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString, page, pageSize, reloadKey]);

  const activeCount = FILTER_KEYS.filter((key) => filters[key]).length;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const firstRow = data.total ? (page - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(page * pageSize, data.total);

  const clearAll = () => {
    setSearch("");
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])));
  };

  const setRange = (days) => update({ from: days === null ? "" : klDaysAgo(days), to: days === null ? "" : klToday() });

  return (
    <section className="card system-logs">
      <div className="system-logs-head">
        <div>
          <h3>System Logs</h3>
          <p className="customer-muted system-logs-sub">
            {loading
              ? "Loading..."
              : `${data.total.toLocaleString("en-MY")} ${data.total === 1 ? "entry" : "entries"}${activeCount ? " match your filters" : ""}`}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="admin-filter-row system-logs-filters" role="search" aria-label="Filter system logs">
        <label className="system-logs-field system-logs-search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Action, user, email, entity or request ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="system-logs-field">
          <span>Action</span>
          <select value={filters.action} onChange={(event) => update({ action: event.target.value })}>
            <option value="">All actions</option>
            {data.facets.actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </label>

        <label className="system-logs-field">
          <span>Entity</span>
          <select value={filters.entityType} onChange={(event) => update({ entityType: event.target.value })}>
            <option value="">All entities</option>
            {data.facets.entityTypes.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </label>

        <label className="system-logs-field">
          <span>Done by</span>
          <select value={filters.actor} onChange={(event) => update({ actor: event.target.value })}>
            {ACTORS.map((actor) => (
              <option key={actor.value} value={actor.value}>{actor.label}</option>
            ))}
          </select>
        </label>

        <label className="system-logs-field">
          <span>From</span>
          <input
            type="date"
            value={filters.from}
            max={filters.to || klToday()}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>

        <label className="system-logs-field">
          <span>To</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            max={klToday()}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>
      </div>

      <div className="system-logs-quick">
        <span className="customer-muted">Quick range:</span>
        <button type="button" className={`system-logs-chip${filters.from === klToday() && filters.to === klToday() ? " is-active" : ""}`} onClick={() => setRange(0)}>Today</button>
        <button type="button" className={`system-logs-chip${filters.from === klDaysAgo(6) && filters.to === klToday() ? " is-active" : ""}`} onClick={() => setRange(6)}>Last 7 days</button>
        <button type="button" className={`system-logs-chip${filters.from === klDaysAgo(29) && filters.to === klToday() ? " is-active" : ""}`} onClick={() => setRange(29)}>Last 30 days</button>
        {activeCount > 0 && (
          <button type="button" className="system-logs-clear" onClick={clearAll}>
            Clear filters ({activeCount})
          </button>
        )}
      </div>

      {error && <div className="alert danger" role="alert">{error}</div>}

      <div className="system-logs-table-wrap" aria-busy={loading}>
        <table className="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>User</th>
              <th>Entity</th>
              <th>Time</th>
              <th aria-label="Details" />
            </tr>
          </thead>

          <tbody>
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    {activeCount ? "No logs match these filters." : "No logs yet."}
                    {activeCount > 0 && (
                      <button type="button" className="btn system-logs-empty-btn" onClick={clearAll}>Clear filters</button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {data.items.map((log) => {
              const open = openId === log.id;
              const detailId = `log-detail-${log.id}`;
              return (
                <Fragment key={log.id}>
                  <tr className={open ? "system-logs-row is-open" : "system-logs-row"}>
                    <td>
                      <button
                        type="button"
                        className="system-logs-action"
                        title="Show only this action"
                        onClick={() => update({ action: log.action })}
                      >
                        {log.action}
                      </button>
                    </td>
                    <td>
                      {log.user ? (
                        <>
                          <span>{log.user.name}</span>
                          {ROLE_LABEL[log.user.role] && (
                            <span className="system-logs-role">{ROLE_LABEL[log.user.role]}</span>
                          )}
                        </>
                      ) : (
                        <span className="customer-muted">System</span>
                      )}
                    </td>
                    <td>
                      {log.entityType}
                      {log.entityId && <span className="system-logs-id">#{log.entityId}</span>}
                    </td>
                    <td className="system-logs-time">{dateTime(log.createdAt)}</td>
                    <td className="system-logs-toggle-cell">
                      <button
                        type="button"
                        className="system-logs-toggle"
                        aria-expanded={open}
                        aria-controls={detailId}
                        onClick={() => setOpenId(open ? null : log.id)}
                      >
                        {open ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr id={detailId} className="system-logs-detail">
                      <td colSpan={5}>
                        <dl className="system-logs-meta">
                          {log.user?.email && (<><dt>Email</dt><dd>{log.user.email}</dd></>)}
                          {log.entityId && (<><dt>Entity ID</dt><dd>{log.entityId}</dd></>)}
                          {log.requestId && (<><dt>Request ID</dt><dd>{log.requestId}</dd></>)}
                          {log.ipAddress && (<><dt>IP address</dt><dd>{log.ipAddress}</dd></>)}
                          <dt>Log ID</dt><dd>{log.id}</dd>
                        </dl>
                        {["before", "after", "details"].some((key) => hasValue(log[key])) ? (
                          <div className="system-logs-json">
                            {["before", "after", "details"].filter((key) => hasValue(log[key])).map((key) => (
                              <div key={key}>
                                <p className="system-logs-json-title">{key === "details" ? "Details" : key === "before" ? "Before" : "After"}</p>
                                <pre>{JSON.stringify(log[key], null, 2)}</pre>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="customer-muted">No extra details were recorded for this entry.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.total > 0 && (
        <div className="operator-pagination">
          <span>
            Showing {firstRow}-{lastRow} of {data.total.toLocaleString("en-MY")}
          </span>
          <div className="operator-pagination-actions">
            <label className="system-logs-page-size">
              Rows
              <select value={pageSize} onChange={(event) => update({ pageSize: event.target.value })}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => update({ page: page - 1 }, { keepPage: true })} disabled={page <= 1 || loading}>
              Prev
            </button>
            <span className="system-logs-page-label">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => update({ page: page + 1 }, { keepPage: true })} disabled={page >= totalPages || loading}>
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
