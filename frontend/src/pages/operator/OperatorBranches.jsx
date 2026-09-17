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
    </div>
  );
}