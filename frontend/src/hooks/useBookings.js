import { useCallback, useEffect, useState } from "react";
import {
  acceptCustomerAlternative,
  cancelCustomerBooking,
  getCustomerBookingActivity,
  getCustomerBookingById,
  getCustomerBookings,
  rejectCustomerAlternative,
} from "../services/customer_service";

export function useCustomerBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCustomerBookings();
      setBookings(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  return { bookings, loading, error, reload: loadBookings };
}

export function useCustomerBooking(id) {
  const [booking, setBooking] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooking = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [bookingRes, activityRes] = await Promise.all([
        getCustomerBookingById(id),
        getCustomerBookingActivity(id).catch(() => ({ data: [] })),
      ]);
      setBooking(bookingRes.data);
      setActivity(activityRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load booking");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const cancelBooking = async () => {
    const res = await cancelCustomerBooking(id);
    setBooking(res.data);
    return res.data;
  };

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const acceptAlternative = async () => {
    const res = await acceptCustomerAlternative(id);
    setBooking(res.data);
    await loadBooking();
    return res.data;
  };

  const rejectAlternative = async () => {
    const res = await rejectCustomerAlternative(id);
    setBooking(res.data);
    await loadBooking();
    return res.data;
  };
  
  return { booking, activity, loading, error, reload: loadBooking, cancelBooking, acceptAlternative, rejectAlternative };
}
