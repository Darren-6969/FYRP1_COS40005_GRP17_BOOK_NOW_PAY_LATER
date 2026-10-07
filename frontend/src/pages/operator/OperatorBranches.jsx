import {
  useEffect,
  useState,
} from "react";

import {
  operatorService,
} from "../../services/operator_service";

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  country: "Malaysia",
  phone: "",
};

const emptyPointForm = {
  label: "",
  address: "",
  note: "",
  usage: "BOTH",
  pickupFee: "0",
  dropoffFee: "0",
};

export default function OperatorBranches() {
  const [branches, setBranches] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editingId, setEditingId] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    selectedBranchId,
    setSelectedBranchId,
  ] = useState(null);

  const [
    pointForm,
    setPointForm,
  ] = useState(emptyPointForm);

  const [
    editingPointId,
    setEditingPointId,
  ] = useState(null);

  const [
    pointSaving,
    setPointSaving,
  ] = useState(false);

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError("");

      const res =
        await operatorService.getBranches();

      setBranches(
        res.data?.branches || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load branches"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  };

  const resetPointForm = () => {
    setPointForm(emptyPointForm);
    setEditingPointId(null);
  };

  const handlePointChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setPointForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (
        name === "usage" &&
        value === "PICKUP"
      ) {
        next.dropoffFee = "0";
      }

      if (
        name === "usage" &&
        value === "DROPOFF"
      ) {
        next.pickupFee = "0";
      }

      return next;
    });
  };

  const managePoints = (branch) => {
    setSelectedBranchId(
      branch.id
    );

    resetPointForm();
    setError("");
  };

  const handlePointEdit = (
    point
  ) => {
    setEditingPointId(
      point.id
    );

    setPointForm({
      label:
        point.label || "",

      address:
        point.address || "",

      note:
        point.note || "",

      usage:
        point.usage ||
        "BOTH",

      pickupFee:
        String(
          point.fee ?? 0
        ),

      dropoffFee:
        String(
          point.dropoffFee ??
            0
        ),
    });

    window.scrollTo({
      top:
        document.body
          .scrollHeight,
      behavior: "smooth",
    });
  };

  const handleEdit = (branch) => {
    setEditingId(branch.id);

    setForm({
      name:
        branch.name || "",

      address:
        branch.address || "",

      city:
        branch.city || "",

      state:
        branch.state || "",

      country:
        branch.country ||
        "Malaysia",

      phone:
        branch.phone || "",
    });
  };

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError(
        "Branch name is required."
      );
      return;
    }

    if (!form.address.trim()) {
      setError(
        "Branch address is required."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name:
          form.name.trim(),

        address:
          form.address.trim(),

        city:
          form.city.trim() ||
          null,

        state:
          form.state.trim() ||
          null,

        country:
          form.country.trim() ||
          "Malaysia",

        phone:
          form.phone.trim() ||
          null,
      };

      if (editingId) {
        await operatorService.updateBranch(
          editingId,
          payload
        );
      } else {
        await operatorService.createBranch(
          payload
        );
      }

      resetForm();

      await loadBranches();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save branch"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus =
    async (branch) => {
      try {
        await operatorService.updateBranch(
          branch.id,
          {
            isActive:
              !branch.isActive,
          }
        );

        await loadBranches();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to update branch"
        );
      }
    };

    const handlePointSubmit =
  async (e) => {
    e.preventDefault();

    if (
      !selectedBranchId
    ) {
      setError(
        "Please select a branch."
      );
      return;
    }

    if (
      !pointForm.label.trim()
    ) {
      setError(
        "Point name is required."
      );
      return;
    }

    const pickupFee =
      Number(
        pointForm.pickupFee
      );

    const dropoffFee =
      Number(
        pointForm.dropoffFee
      );

    if (
      Number.isNaN(
        pickupFee
      ) ||
      pickupFee < 0
    ) {
      setError(
        "Pickup charge must be 0 or more."
      );
      return;
    }

    if (
      Number.isNaN(
        dropoffFee
      ) ||
      dropoffFee < 0
    ) {
      setError(
        "Drop-off charge must be 0 or more."
      );
      return;
    }

    const payload = {
      label:
        pointForm.label.trim(),

      address:
        pointForm.address
          .trim() ||
        null,

      note:
        pointForm.note
          .trim() ||
        null,

      usage:
        pointForm.usage,

      pickupFee:
        pointForm.usage ===
        "DROPOFF"
          ? 0
          : pickupFee,

      dropoffFee:
        pointForm.usage ===
        "PICKUP"
          ? 0
          : dropoffFee,
    };

    try {
      setPointSaving(true);
      setError("");

      if (
        editingPointId
      ) {
        await operatorService
          .updateBranchPoint(
            selectedBranchId,
            editingPointId,
            payload
          );
      } else {
        await operatorService
          .createBranchPoint(
            selectedBranchId,
            payload
          );
      }

      resetPointForm();

      await loadBranches();
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to save pickup/drop-off point"
      );
    } finally {
      setPointSaving(
        false
      );
    }
  };

  const togglePointStatus =
  async (
    branch,
    point
  ) => {
    try {
      setError("");

      await operatorService
        .updateBranchPoint(
          branch.id,
          point.id,
          {
            isActive:
              !point.isActive,
          }
        );

      await loadBranches();
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to update point"
      );
    }
  };

  const selectedBranch =
  branches.find(
    (branch) =>
      branch.id ===
      selectedBranchId
  );

  return (
    <div className="operator-page">

      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">
            Catalogue Management
          </p>

          <h1>Branches</h1>

          <p>
            Manage pickup locations used
            by your listings.
          </p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
        </div>
      )}

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>
              {editingId
                ? "Edit Branch"
                : "Add Branch"}
            </h2>

            <p>
              Each listing belongs to
              exactly one branch.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
        >
          <div className="operator-form-grid">

            <label className="operator-field">
              Branch Name *

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Kuching Airport Branch"
              />
            </label>

            <label className="operator-field">
              Phone

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+60..."
              />
            </label>

            <label className="operator-field operator-field-full">
              Address *

              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Full branch address"
              />
            </label>

            <label className="operator-field">
              City

              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Kuching"
              />
            </label>

            <label className="operator-field">
              State

              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Sarawak"
              />
            </label>

            <label className="operator-field">
              Country

              <input
                name="country"
                value={form.country}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="operator-form-actions">
            {editingId && (
              <button
                type="button"
                className="operator-secondary-btn"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}

            <button
              type="submit"
              className="operator-primary-btn"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Save Changes"
                : "Add Branch"}
            </button>
          </div>
        </form>
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>
              Existing Branches
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="operator-empty-state">
            Loading branches...
          </div>
        ) : branches.length === 0 ? (
          <div className="operator-empty-state">
            No branches found.
          </div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {branches.map(
                  (branch) => (
                    <tr
                      key={
                        branch.id
                      }
                    >
                      <td>
                        <strong>
                          {branch.name}
                        </strong>
                      </td>

                      <td>
                        {[
                          branch.address,
                          branch.city,
                          branch.state,
                          branch.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </td>

                      <td>
                        {branch.phone ||
                          "-"}
                      </td>

                      <td>
                        <span
                          className={`operator-status ${
                            branch.isActive
                              ? "success"
                              : "danger"
                          }`}
                        >
                          {branch.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="operator-table-actions">
                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(
                                branch
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              managePoints(
                                branch
                              )
                            }
                          >
                            Manage Points
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleBranchStatus(
                                branch
                              )
                            }
                          >
                            {branch.isActive
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selectedBranch && (
        <section className="operator-card">
          <div className="operator-card-head">
            <div>
              <p className="operator-eyebrow">
                {selectedBranch.name}
              </p>

              <h2>
                Pickup & Drop-off Points
              </h2>

              <p>
                Add fixed pickup and
                drop-off points for this
                branch.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handlePointSubmit
            }
          >
            <div className="operator-form-grid">

              <label className="operator-field">
                Point Name *

                <input
                  name="label"
                  value={
                    pointForm.label
                  }
                  onChange={
                    handlePointChange
                  }
                  placeholder="Kuching Airport Counter"
                />
              </label>

              <label className="operator-field">
                Usage *

                <select
                  name="usage"
                  value={
                    pointForm.usage
                  }
                  onChange={
                    handlePointChange
                  }
                >
                  <option value="PICKUP">
                    Pickup only
                  </option>

                  <option value="DROPOFF">
                    Drop-off only
                  </option>

                  <option value="BOTH">
                    Pickup & Drop-off
                  </option>
                </select>
              </label>

              <label className="operator-field operator-field-full">
                Address

                <input
                  name="address"
                  value={
                    pointForm.address
                  }
                  onChange={
                    handlePointChange
                  }
                  placeholder="Full pickup/drop-off address"
                />
              </label>

              <label className="operator-field">
                Pickup Charge (RM)

                <input
                  type="number"
                  name="pickupFee"
                  min="0"
                  step="0.01"
                  value={
                    pointForm.pickupFee
                  }
                  onChange={
                    handlePointChange
                  }
                  disabled={
                    pointForm.usage ===
                    "DROPOFF"
                  }
                />
              </label>

              <label className="operator-field">
                Drop-off Charge (RM)

                <input
                  type="number"
                  name="dropoffFee"
                  min="0"
                  step="0.01"
                  value={
                    pointForm.dropoffFee
                  }
                  onChange={
                    handlePointChange
                  }
                  disabled={
                    pointForm.usage ===
                    "PICKUP"
                  }
                />
              </label>

              <label className="operator-field operator-field-full">
                Note

                <input
                  name="note"
                  value={
                    pointForm.note
                  }
                  onChange={
                    handlePointChange
                  }
                  placeholder="Example: Meet at arrival hall"
                />
              </label>
            </div>

            <div className="operator-form-actions">
              {editingPointId && (
                <button
                  type="button"
                  className="operator-secondary-btn"
                  onClick={
                    resetPointForm
                  }
                  disabled={
                    pointSaving
                  }
                >
                  Cancel Edit
                </button>
              )}

              <button
                type="submit"
                className="operator-primary-btn"
                disabled={
                  pointSaving
                }
              >
                {pointSaving
                  ? "Saving..."
                  : editingPointId
                  ? "Save Point Changes"
                  : "Add Point"}
              </button>
            </div>
          </form>

          <div
            className="operator-table-wrap"
            style={{
              marginTop: "24px",
            }}
          >
            {!selectedBranch
              .pickupPoints
              ?.length ? (
              <div className="operator-empty-state">
                No pickup or drop-off
                points found for this
                branch.
              </div>
            ) : (
              <table className="operator-table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th>Usage</th>
                    <th>Pickup</th>
                    <th>Drop-off</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedBranch
                    .pickupPoints
                    .map((point) => (
                      <tr
                        key={
                          point.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              point.label
                            }
                          </strong>

                          {point.address && (
                            <div>
                              {
                                point.address
                              }
                            </div>
                          )}
                        </td>

                        <td>
                          {point.usage ===
                          "PICKUP"
                            ? "Pickup"
                            : point.usage ===
                              "DROPOFF"
                            ? "Drop-off"
                            : "Both"}
                        </td>

                        <td>
                          {point.usage ===
                          "DROPOFF"
                            ? "-"
                            : `RM ${Number(
                                point.fee ||
                                  0
                              ).toFixed(
                                2
                              )}`}
                        </td>

                        <td>
                          {point.usage ===
                          "PICKUP"
                            ? "-"
                            : `RM ${Number(
                                point.dropoffFee ||
                                  0
                              ).toFixed(
                                2
                              )}`}
                        </td>

                        <td>
                          <span
                            className={`operator-status ${
                              point.isActive
                                ? "success"
                                : "danger"
                            }`}
                          >
                            {point.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className="operator-table-actions">
                            <button
                              type="button"
                              onClick={() =>
                                handlePointEdit(
                                  point
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                togglePointStatus(
                                  selectedBranch,
                                  point
                                )
                              }
                            >
                              {point.isActive
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}