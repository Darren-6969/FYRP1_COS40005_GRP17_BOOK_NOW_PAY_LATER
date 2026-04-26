import { useEffect, useState } from "react";
import { getLogs } from "../../services/system_service";

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    getLogs().then((res) => setLogs(res.data));
  }, []);

  return (
    <section className="card">
      <h3>System Logs</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Action</th>
            <th>User</th>
            <th>Entity</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.action}</td>
              <td>{log.user?.name || "System"}</td>
              <td>{log.entityType}</td>
              <td>
                {new Date(log.createdAt).toLocaleString("en-MY")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}