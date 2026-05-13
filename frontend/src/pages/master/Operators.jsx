import { useEffect, useMemo, useState } from "react";
import {
  createOperator,
  createOperatorUser,
  deleteOperator,
  getOperators,
  updateOperatorStatus,
} from "../../services/admin_service";

const LOGO_MAX_FILE_SIZE = 500 * 1024; // 500KB
const LOGO_MAX_WIDTH = 600;
const LOGO_MAX_HEIGHT = 600;
const LOGO_RECOMMENDED_TEXT =
  "Recommended logo size: 300x300px square. Accepted: PNG, JPG, WebP. Max file size: 500KB. Max dimension: 600x600px.";

const initialCompanyForm = {
  companyName: "",
  operatorName: "",
  email: "",
  phone: "",
  logoUrl: "",
  password: "Password123!",
  sendWelcomeEmail: true,
};

const initialStaffForm = {
  operatorId: "",
  name: "",
  email: "",
  password: "Password123!",
  accessLevel: "STAFF",
  sendWelcomeEmail: true,
};

function countByBookingStatus(bookings = [], status) {
  return bookings.filter(
    (booking) => String(booking.status || "").toUpperCase() === status
  ).length;
}

function countPendingVerification(bookings = []) {
  return bookings.filter(
    (booking) =>
      String(booking.payment?.status || "").toUpperCase() ===
      "PENDING_VERIFICATION"
  ).length;
}

function countPaidBookings(bookings = []) {
  return bookings.filter((booking) => {
    const bookingStatus = String(booking.status || "").toUpperCase();
    const paymentStatus = String(booking.payment?.status || "").toUpperCase();

    return bookingStatus === "PAID" || paymentStatus === "PAID";
  }).length;
}

function readinessLabel(op) {
  const hasConfig = Array.isArray(op.configs) && op.configs.length > 0;
  const hasLoginUser = Array.isArray(op.users) && op.users.length > 0;
  const hasStripe = Boolean(op.stripeAccountId);

  if (hasConfig && hasLoginUser && hasStripe) {
    return {
      label: "Ready",
      className: "active",
    };
  }

  if (hasConfig && hasLoginUser) {
    return {
      label: "Config Ready",
      className: "pending",
    };
  }

  return {
    label: "Incomplete",
    className: "suspended",
  };
}

function getOwnerUser(op) {
  return (op.users || []).find(
    (user) => String(user.operatorAccessLevel || "").toUpperCase() === "OWNER"
  );
}

function getStaffUsers(op) {
  return (op.users || []).filter(
    (user) => String(user.operatorAccessLevel || "").toUpperCase() === "STAFF"
  );
}

function getAccountSummary(op) {
  const owner = getOwnerUser(op);
  const staffUsers = getStaffUsers(op);

  return {
    owner,
    staffUsers,
    ownerCount: owner ? 1 : 0,
    staffCount: staffUsers.length,
    total: op.users?.length || 0,
  };
}

function accessLevelBadgeClass(level) {
  const normalized = String(level || "").toUpperCase();

  if (normalized === "OWNER") return "active";
  if (normalized === "STAFF") return "pending";

  return "suspended";
}

function accessLevelDescription(level) {
  const normalized = String(level || "").toUpperCase();

  if (normalized === "OWNER") {
    return "Full access to all operator features";
  }

  if (normalized === "STAFF") {
    return "Booking operations, manual payment verification, invoices, profile and notifications";
  }

  return "No access level assigned";
}

function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Logo must be a PNG, JPG, JPEG, or WebP image."));
      return;
    }

    if (file.size > LOGO_MAX_FILE_SIZE) {
      reject(new Error("Logo file size must be 500KB or below."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result;
      const image = new Image();

      image.onload = () => {
        if (image.width > LOGO_MAX_WIDTH || image.height > LOGO_MAX_HEIGHT) {
          reject(
            new Error(
              `Logo dimension must not exceed ${LOGO_MAX_WIDTH}x${LOGO_MAX_HEIGHT}px. Current image is ${image.width}x${image.height}px.`
            )
          );
          return;
        }

        resolve(dataUrl);
      };

      image.onerror = () => {
        reject(new Error("Invalid image file. Please upload another logo."));
      };

      image.src = dataUrl;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read logo file."));
    };

    reader.readAsDataURL(file);
  });
}

export default function Operators() {
  const [operators, setOperators] = useState([]);

  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const [staffForm, setStaffForm] = useState(initialStaffForm);

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [expandedOperatorId, setExpandedOperatorId] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getOperators();
      setOperators(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operators");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const ownerCount = operators.reduce(
      (total, op) => total + (getOwnerUser(op) ? 1 : 0),
      0
    );

    const staffCount = operators.reduce(
      (total, op) => total + getStaffUsers(op).length,
      0
    );

    return {
      total: operators.length,
      active: operators.filter((op) => op.status === "ACTIVE").length,
      suspended: operators.filter((op) => op.status === "SUSPENDED").length,
      incomplete: operators.filter(
        (op) => readinessLabel(op).label === "Incomplete"
      ).length,
      owners: ownerCount,
      staff: staffCount,
    };
  }, [operators]);

  const filteredOperators = useMemo(() => {
    return operators.filter((op) => {
      const text = [
        op.operatorCode,
        op.companyName,
        op.email,
        op.phone,
        ...(op.users || []).map((user) =>
          [
            user.name,
            user.email,
            user.role,
            user.operatorAccessLevel,
          ]
            .filter(Boolean)
            .join(" ")
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || op.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [operators, query, statusFilter]);

  const handleCompanyChange = (event) => {
    const { name, value, type, checked } = event.target;

    setCompanyForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleStaffChange = (event) => {
    const { name, value, type, checked } = event.target;

    setStaffForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];

    try {
      setError("");
      setMessage("");

      const dataUrl = await readLogoFile(file);

      setCompanyForm((prev) => ({
        ...prev,
        logoUrl: dataUrl,
      }));

      if (dataUrl) {
        setMessage("Logo uploaded successfully.");
      }
    } catch (err) {
      event.target.value = "";
      setCompanyForm((prev) => ({
        ...prev,
        logoUrl: "",
      }));
      setError(err.message || "Failed to upload logo.");
    }
  };

  const handleCreateCompany = async (event) => {
    event.preventDefault();

    try {
      setSavingCompany(true);
      setError("");
      setMessage("");

      await createOperator(companyForm);

      setCompanyForm(initialCompanyForm);
      setShowCompanyForm(false);
      setMessage(
        "Company/operator and OWNER login account created successfully."
      );
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to create company/operator"
      );
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();

    if (!staffForm.operatorId) {
      setError("Please select a company for this staff account.");
      return;
    }

    try {
      setSavingStaff(true);
      setError("");
      setMessage("");

      await createOperatorUser(staffForm.operatorId, {
        name: staffForm.name,
        email: staffForm.email,
        password: staffForm.password,
        accessLevel: staffForm.accessLevel,
        sendWelcomeEmail: staffForm.sendWelcomeEmail,
      });

      setStaffForm(initialStaffForm);
      setShowStaffForm(false);
      setMessage("Staff account created successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create staff account");
    } finally {
      setSavingStaff(false);
    }
  };

  const toggleExpandedOperator = (operatorId) => {
    setExpandedOperatorId((currentId) =>
      currentId === operatorId ? null : operatorId
    );
  };

  const openStaffFormForOperator = (op) => {
    setStaffForm((prev) => ({
      ...prev,
      operatorId: String(op.id),
      accessLevel: "STAFF",
    }));
    setShowStaffForm(true);
    setShowCompanyForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleStatus = async (op) => {
    const nextStatus = op.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    if (!window.confirm(`Change ${op.companyName} to ${nextStatus}?`)) return;

    try {
      setError("");
      setMessage("");
      await updateOperatorStatus(op.id, nextStatus);
      setMessage(`${op.companyName} updated to ${nextStatus}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update operator status");
    }
  };

  const handleDelete = async (op) => {
    const bookingCount = op.bookings?.length || 0;

    if (bookingCount > 0) {
      alert(
        `${op.companyName} has ${bookingCount} booking(s). It cannot be deleted because booking/payment/invoice history must be preserved. Suspend this operator instead.`
      );
      return;
    }

    const confirmText = `DELETE ${op.companyName}`;

    const typed = window.prompt(
      `This will permanently delete the operator company, its operator login users, BNPL config, and pending host intents.\n\nType exactly: ${confirmText}`
    );

    if (typed !== confirmText) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await deleteOperator(op.id);
      setMessage(`${op.companyName} was deleted successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete operator");
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator Companies</h3>
            <p>
              Create company/operator profiles, add staff accounts, and manage
              operator access.
            </p>
          </div>

          <div className="actions">
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setShowCompanyForm((prev) => !prev);
                setShowStaffForm(false);
              }}
            >
              {showCompanyForm ? "Close Company Form" : "Create Company"}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => {
                setShowStaffForm((prev) => !prev);
                setShowCompanyForm(false);
              }}
            >
              {showStaffForm ? "Close Staff Form" : "Add Staff Account"}
            </button>
          </div>
        </div>

        {error && <div className="alert danger">{error}</div>}
        {message && <div className="alert">{message}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Companies</span>
            <strong>{summary.total}</strong>
          </div>

          <div className="stat-card">
            <span>Active</span>
            <strong>{summary.active}</strong>
          </div>

          <div className="stat-card">
            <span>Suspended</span>
            <strong>{summary.suspended}</strong>
          </div>

          <div className="stat-card">
            <span>Owners</span>
            <strong>{summary.owners}</strong>
          </div>

          <div className="stat-card">
            <span>Staff</span>
            <strong>{summary.staff}</strong>
          </div>

          <div className="stat-card">
            <span>Incomplete Setup</span>
            <strong>{summary.incomplete}</strong>
          </div>
        </div>

        {showCompanyForm && (
          <form className="admin-form-grid" onSubmit={handleCreateCompany}>
            <label>
              <span>Company Name</span>
              <input
                name="companyName"
                value={companyForm.companyName}
                onChange={handleCompanyChange}
                required
              />
            </label>

            <label>
              <span>Owner Name</span>
              <input
                name="operatorName"
                value={companyForm.operatorName}
                onChange={handleCompanyChange}
                placeholder="Person in charge / company owner"
              />
            </label>

            <label>
              <span>Owner Login Email</span>
              <input
                type="email"
                name="email"
                value={companyForm.email}
                onChange={handleCompanyChange}
                required
              />
            </label>

            <label>
              <span>Temporary Password</span>
              <input
                name="password"
                value={companyForm.password}
                onChange={handleCompanyChange}
                required
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                name="phone"
                value={companyForm.phone}
                onChange={handleCompanyChange}
              />
            </label>

            <label>
              <span>Company Logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
              />
              <small>{LOGO_RECOMMENDED_TEXT}</small>
            </label>

            {companyForm.logoUrl && (
              <div>
                <span>Logo Preview</span>
                <div
                  style={{
                    marginTop: 8,
                    width: 96,
                    height: 96,
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                  }}
                >
                  <img
                    src={companyForm.logoUrl}
                    alt="Company logo preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>

                <button
                  className="btn"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      logoUrl: "",
                    }))
                  }
                >
                  Remove Logo
                </button>
              </div>
            )}

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="sendWelcomeEmail"
                checked={companyForm.sendWelcomeEmail}
                onChange={handleCompanyChange}
              />
              <span>Send welcome email with owner login details</span>
            </label>

            <div className="admin-form-actions">
              <button className="btn primary" disabled={savingCompany}>
                {savingCompany
                  ? "Creating..."
                  : "Create Company + OWNER Login"}
              </button>
            </div>
          </form>
        )}

        {showStaffForm && (
          <form className="admin-form-grid" onSubmit={handleCreateStaff}>
            <label>
              <span>Select Company</span>
              <select
                name="operatorId"
                value={staffForm.operatorId}
                onChange={handleStaffChange}
                required
              >
                <option value="">Select company/operator</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.companyName} ({op.operatorCode})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Staff Name</span>
              <input
                name="name"
                value={staffForm.name}
                onChange={handleStaffChange}
                required
              />
            </label>

            <label>
              <span>Staff Login Email</span>
              <input
                type="email"
                name="email"
                value={staffForm.email}
                onChange={handleStaffChange}
                required
              />
            </label>

            <label>
              <span>Temporary Password</span>
              <input
                name="password"
                value={staffForm.password}
                onChange={handleStaffChange}
                required
              />
            </label>

            <label>
              <span>Access Level</span>
              <select
                name="accessLevel"
                value={staffForm.accessLevel}
                onChange={handleStaffChange}
              >
                <option value="STAFF">STAFF</option>
                <option value="OWNER">OWNER</option>
              </select>
              <small>
                STAFF can manage booking operations, manual payment
                verification, invoices, profile and notifications. OWNER can
                access all operator features.
              </small>
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="sendWelcomeEmail"
                checked={staffForm.sendWelcomeEmail}
                onChange={handleStaffChange}
              />
              <span>Send welcome email with staff login details</span>
            </label>

            <div className="admin-form-actions">
              <button className="btn primary" disabled={savingStaff}>
                {savingStaff ? "Creating..." : "Create Staff Account"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Company / Operator List</h3>
            <p>
              Each company can have one OWNER account and multiple STAFF
              accounts. Delete is only allowed for wrongly created companies
              with no bookings.
            </p>
          </div>
        </div>

        <div className="admin-filter-row">
          <input
            placeholder="Search operator code, company, email, user, access level..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading operators...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>

                <th>Company</th>
                <th>Status</th>
                <th>Readiness</th>
                <th>Accounts</th>
                <th>Bookings</th>
                <th>Pending Verification</th>
                <th>Overdue</th>
                <th>Paid</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOperators.map((op) => {
                const readiness = readinessLabel(op);
                const bookings = op.bookings || [];
                const bookingCount = bookings.length;
                const accounts = getAccountSummary(op);
                const isExpanded = expandedOperatorId === op.id;

                return (
                  <>
                    <tr key={op.id}>
                      <td>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {op.logoUrl && (
                            <img
                              src={op.logoUrl}
                              alt={`${op.companyName} logo`}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                objectFit: "contain",
                                border: "1px solid #ddd",
                                background: "#fff",
                              }}
                            />
                          )}

                          <div>
                            <strong>{op.companyName}</strong>
                            <br />
                            <small>{op.phone || "-"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${String(op.status).toLowerCase()}`}>
                          {op.status}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${readiness.className}`}>
                          {readiness.label}
                        </span>
                        <br />
                        <small>{op.stripeAccountId ? "Stripe linked" : "No Stripe"}</small>
                      </td>

                      <td>
                        <strong>
                          {accounts.ownerCount} Owner · {accounts.staffCount} Staff
                        </strong>
                        <br />
                        <small>{accounts.total} total login account(s)</small>

                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => toggleExpandedOperator(op.id)}
                          >
                            {isExpanded ? "Hide Accounts" : "View Accounts"}
                          </button>
                        </div>
                      </td>

                      <td>{bookingCount}</td>
                      <td>{countPendingVerification(bookings)}</td>
                      <td>{countByBookingStatus(bookings, "OVERDUE")}</td>
                      <td>{countPaidBookings(bookings)}</td>

                      <td>
                        <div className="actions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => openStaffFormForOperator(op)}
                          >
                            Add Staff
                          </button>

                          <button className="btn" type="button" onClick={() => toggleStatus(op)}>
                            {op.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>

                          <button
                            className="btn danger"
                            type="button"
                            disabled={bookingCount > 0}
                            title={
                              bookingCount > 0
                                ? "Cannot delete a company/operator with existing bookings"
                                : "Delete wrongly created company/operator"
                            }
                            onClick={() => handleDelete(op)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${op.id}-accounts`}>
                        <td colSpan="10">
                          <div
                            style={{
                              padding: "16px",
                              borderRadius: "12px",
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "12px",
                                alignItems: "center",
                                marginBottom: "12px",
                              }}
                            >
                              <div>
                                <strong>Accounts under {op.companyName}</strong>
                                <p style={{ margin: "4px 0 0" }}>
                                  Owner and staff login accounts linked to this company.
                                </p>
                              </div>

                              <button
                                className="btn primary"
                                type="button"
                                onClick={() => openStaffFormForOperator(op)}
                              >
                                Add Staff Account
                              </button>
                            </div>

                            <div style={{ display: "grid", gap: "10px" }}>
                              {(op.users || []).map((user) => {
                                const level = user.operatorAccessLevel || "UNASSIGNED";

                                return (
                                  <div
                                    key={user.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1.2fr 1.4fr 0.7fr 1.8fr",
                                      gap: "12px",
                                      alignItems: "center",
                                      padding: "12px",
                                      borderRadius: "10px",
                                      background: "#ffffff",
                                      border: "1px solid #e5e7eb",
                                    }}
                                  >
                                    <div>
                                      <strong>{user.name}</strong>
                                      <br />
                                      <small>{user.userCode || `User ID: ${user.id}`}</small>
                                    </div>

                                    <div>
                                      <small>Email</small>
                                      <br />
                                      <strong>{user.email}</strong>
                                    </div>

                                    <div>
                                      <span
                                        className={`badge ${accessLevelBadgeClass(level)}`}
                                      >
                                        {level}
                                      </span>
                                    </div>

                                    <div>
                                      <small>{accessLevelDescription(level)}</small>
                                    </div>
                                  </div>
                                );
                              })}

                              {!op.users?.length && (
                                <div className="empty-state">
                                  No login accounts found for this company.
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {!filteredOperators.length && (
                <tr>
                  <td colSpan="10">No operators found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}