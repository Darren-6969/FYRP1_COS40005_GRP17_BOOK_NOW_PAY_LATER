import { useEffect, useState } from "react";
import { operatorService } from "../../services/operator_service";

export default function OperatorServicesInventory() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServices = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getServices();

      setServices(res.data.services || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Services & Inventory</h1>
          <p>Services will be connected once the service/vehicle/room model is added to backend.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadServices}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        {loading ? (
          <div className="operator-empty-state">Loading services...</div>
        ) : services.length ? (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>{service.name}</td>
                    <td>{service.status}</td>
                    <td>View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="operator-empty-state">
            No services found. Your current database schema does not have a Service / Vehicle / Room table yet.
          </div>
        )}
      </section>
    </div>
  );
}