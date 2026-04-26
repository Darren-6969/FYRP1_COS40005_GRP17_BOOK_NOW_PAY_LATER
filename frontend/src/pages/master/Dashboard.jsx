import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { getBookings } from "../../services/booking_service";
import { getPayments } from "../../services/payment_service";

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    Promise.all([getBookings(), getPayments()]).then(([b, p]) => {
      setBookings(b.data);
      setPayments(p.data);
    });
  }, []);

  const totalRevenue = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const overdue = payments.filter((p) => p.status === "OVERDUE").length;

  const statusData = [
    { name: "Pending", value: bookings.filter((b) => b.status === "PENDING").length, color: "#BA7517" },
    { name: "Accepted", value: bookings.filter((b) => b.status === "ACCEPTED").length, color: "#185FA5" },
    { name: "Paid", value: bookings.filter((b) => b.status === "PAID").length, color: "#1D9E75" },
    { name: "Rejected", value: bookings.filter((b) => b.status === "REJECTED").length, color: "#E24B4A" },
  ];

  const revenueData = [
    { month: "Jan", value: 12000 },
    { month: "Feb", value: 18000 },
    { month: "Mar", value: 24000 },
    { month: "Apr", value: totalRevenue },
  ];

  return (
    <div>
      <div className="grid-4">
        <Metric title="Total Bookings" value={bookings.length} />
        <Metric title="Revenue" value={`RM ${totalRevenue.toFixed(2)}`} />
        <Metric title="Overdue Payments" value={overdue} />
        <Metric title="Payments" value={payments.length} />
      </div>

      <div className="grid-2 mt">
        <section className="card">
          <h3>Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#185FA5" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h3>Booking Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={85}>
                {statusData.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <section className="card metric">
      <span>{title}</span>
      <strong>{value}</strong>
    </section>
  );
}