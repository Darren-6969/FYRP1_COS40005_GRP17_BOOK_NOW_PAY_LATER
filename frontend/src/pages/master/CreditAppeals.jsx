import { useEffect, useState } from "react";
import api from "../../services/api";

export default function CreditAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [resolutions, setResolutions] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get(`/credit/appeals?status=${status}`)
      .then((response) => {
        if (!active) return;
        setAppeals(response.data.appeals || []);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error.response?.data?.message || "Unable to load credit appeals.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [status]);

  const decide = async (id, decision) => {
    const resolution = resolutions[id]?.trim();
    if (!resolution) {
      setMessage("Enter a resolution before saving the decision.");
      return;
    }
    try {
      await api.patch(`/credit/appeals/${id}/decision`, { decision, resolution });
      setMessage(`Appeal ${decision.toLowerCase()} successfully.`);
      const response = await api.get(`/credit/appeals?status=${status}`);
      setAppeals(response.data.appeals || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save the appeal decision.");
    }
  };

  return (
    <main className="master-page">
      <div className="page-header">
        <div><h1>Credit Appeals</h1><p>Review customer disputes before they affect future terms.</p></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Appeal status">
          <option value="PENDING">Pending</option><option value="UPHELD">Upheld</option><option value="REJECTED">Rejected</option>
        </select>
      </div>
      {message && <div className="alert">{message}</div>}
      {loading ? <p>Loading appeals...</p> : appeals.length === 0 ? <p>No appeals in this queue.</p> : (
        <div className="master-card-list">
          {appeals.map((appeal) => {
            const booking = appeal.event?.booking;
            return (
              <article className="master-card" key={appeal.id}>
                <div className="page-header">
                  <div>
                    <h2>Appeal #{appeal.id} · {appeal.customer?.name || appeal.customer?.email}</h2>
                    <p>{appeal.event?.eventType} · {new Date(appeal.event?.createdAt).toLocaleString()}</p>
                  </div>
                  <strong>{appeal.event?.beforeTier} → {appeal.event?.afterTier}</strong>
                </div>
                <p><b>Customer statement:</b> {appeal.reason}</p>
                <p><b>Event reason:</b> {appeal.event?.reason || "—"}</p>
                <p><b>Booking:</b> {booking?.bookingCode || "Not linked"} · <b>Operator:</b> {booking?.operator?.companyName || "—"}</p>
                <p><b>Operator remark:</b> {booking?.noShowRemark || "—"}</p>
                {appeal.status === "PENDING" && (
                  <>
                    <textarea
                      value={resolutions[appeal.id] || ""}
                      onChange={(event) => setResolutions((current) => ({ ...current, [appeal.id]: event.target.value }))}
                      placeholder="Mandatory administrator resolution"
                      rows={3}
                    />
                    <div className="button-row">
                      <button type="button" onClick={() => decide(appeal.id, "UPHELD")}>Uphold appeal</button>
                      <button type="button" className="secondary" onClick={() => decide(appeal.id, "REJECTED")}>Reject appeal</button>
                    </div>
                  </>
                )}
                {appeal.status !== "PENDING" && <p><b>Resolution:</b> {appeal.resolution}</p>}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
