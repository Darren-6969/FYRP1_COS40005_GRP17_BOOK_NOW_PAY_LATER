import { useEffect, useState } from "react";
import { getPayments } from "../../services/payment_service";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function SalesReport() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    getPayments().then((res) => setPayments(res.data));
  }, []);

  const paidPayments = payments.filter((p) => p.status === "PAID");

  const total = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const chartData = [
    { label: "Paid Revenue", value: total },
    { label: "Transactions", value: paidPayments.length },
  ];

  return (
    <section className="card">
      <h3>Sales Report</h3>
      <p className="muted">Total revenue: RM {total.toFixed(2)}</p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#185FA5" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}