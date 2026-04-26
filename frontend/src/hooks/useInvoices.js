import { useCallback, useEffect, useState } from "react";
import { getCustomerInvoices } from "../services/customer_service";

export function useCustomerInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCustomerInvoices();
      setInvoices(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  return { invoices, loading, error, reload: loadInvoices };
}
