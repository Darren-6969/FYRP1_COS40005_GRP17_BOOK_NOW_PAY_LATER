import { useCallback, useEffect, useState } from "react";
import { getCustomerPayments, payCustomerBooking } from "../services/customer_service";

export function useCustomerPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCustomerPayments();
      setPayments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  return { payments, loading, error, reload: loadPayments };
}

export async function submitCustomerPayment(bookingId, payload) {
  const res = await payCustomerBooking(bookingId, payload);
  return res.data;
}
