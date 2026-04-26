import { useEffect, useState } from "react";
import {
  getOperators,
  updateOperatorStatus,
} from "../../services/operator_service";

export default function Operators() {
  const [operators, setOperators] = useState([]);

  const load = async () => {
    const res = await getOperators();
    setOperators(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (op) => {
    const nextStatus = op.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await updateOperatorStatus(op.id, nextStatus);
    load();
  };

  return (
    <section className="card">
      <h3>Operator Accounts</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Email</th>
            <th>Status</th>
            <th>Bookings</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {operators.map((op) => (
            <tr key={op.id}>
              <td>{op.companyName}</td>
              <td>{op.email}</td>
              <td><span className={`badge ${String(op.status).toLowerCase()}`}>{op.status}</span></td>
              <td>{op.bookings?.length || 0}</td>
              <td>
                <button className="btn" onClick={() => toggleStatus(op)}>
                  {op.status === "ACTIVE" ? "Suspend" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}