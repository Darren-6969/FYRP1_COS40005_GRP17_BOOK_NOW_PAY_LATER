import { useCallback, useEffect, useState } from "react";
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "../services/customer_service";
import { operatorService } from "../services/operator_service";

export function useCustomerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await getCustomerNotifications();
      setNotifications(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = async (id) => {
    await markCustomerNotificationRead(id);
    await loadNotifications();
  };

  const markAllRead = async () => {
    await markAllCustomerNotificationsRead();
    await loadNotifications();
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    loading,
    error,
    reload: loadNotifications,
    markRead,
    markAllRead,
  };
}

export function useOperatorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await operatorService.getNotifications();
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = async (id) => {
    await operatorService.markNotificationRead(id);
    await loadNotifications();
  };

  const markAllRead = async () => {
    await operatorService.markAllNotificationsRead();
    await loadNotifications();
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    loading,
    error,
    reload: loadNotifications,
    markRead,
    markAllRead,
  };
}