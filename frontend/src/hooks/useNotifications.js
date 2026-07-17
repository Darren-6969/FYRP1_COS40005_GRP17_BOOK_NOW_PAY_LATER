import { useCallback, useEffect, useState } from "react";
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "../services/customer_service";
import { operatorService } from "../services/operator_service";
import {
  connectUserSocket,
  disconnectUserSocket,
  isRealtimeEnabled,
} from "../services/socket_service";
import { getUser as getStoredUser } from "../utils/session";

const POLLING_INTERVAL_MS = 4500;

function normalizeNotifications(payload) {
  return Array.isArray(payload) ? payload : [];
}

function mergeNotification(currentNotifications, incomingNotification) {
  if (!incomingNotification?.id) return currentNotifications;

  const exists = currentNotifications.some(
    (item) => item.id === incomingNotification.id
  );

  if (exists) {
    return currentNotifications.map((item) =>
      item.id === incomingNotification.id ? incomingNotification : item
    );
  }

  return [incomingNotification, ...currentNotifications];
}

function useNotificationsWithFallback({
  role,
  fetchNotifications,
  markReadApi,
  markAllReadApi,
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(!isRealtimeEnabled());
  const [error, setError] = useState("");

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const res = await fetchNotifications();
        const payload = res.data?.notifications || res.data || [];
        setNotifications(normalizeNotifications(payload));
      } catch (err) {
        if (!silent) {
          setError(
            err.response?.data?.message || "Failed to load notifications"
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchNotifications]
  );

  const markRead = async (id) => {
    await markReadApi(id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      )
    );
  };

  const markAllRead = async () => {
    await markAllReadApi();

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        isRead: true,
      }))
    );
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Polling fallback for Vercel backend (near-real-time without WebSockets)
  useEffect(() => {
    if (isRealtimeEnabled()) return;

    setSocketConnected(false);
    setPollingEnabled(true);

    const intervalId = window.setInterval(() => {
      // Skip polling while the tab is hidden to save API calls.
      if (document.visibilityState === "visible") {
        loadNotifications({ silent: true });
      }
    }, POLLING_INTERVAL_MS);

    // Refetch immediately when the user returns to the tab/window.
    const refetch = () => loadNotifications({ silent: true });
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [loadNotifications]);

  // Let any page request an immediate notification refresh after an action.
  useEffect(() => {
    const onManualRefresh = () => loadNotifications({ silent: true });
    window.addEventListener("bnpl:refresh-notifications", onManualRefresh);
    return () =>
      window.removeEventListener("bnpl:refresh-notifications", onManualRefresh);
  }, [loadNotifications]);
  
  // Socket.IO mode only when explicitly enabled
  useEffect(() => {
    if (!isRealtimeEnabled()) {
      setSocketConnected(false);
      return;
    }

    const user = getStoredUser();
    if (!user?.id) return;

    const socket = connectUserSocket(user.id);

    // Important: prevent null socket crash
    if (!socket) {
      setSocketConnected(false);
      setPollingEnabled(true);
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      setPollingEnabled(false);
      socket.emit("join_user_room", user.id);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setPollingEnabled(true);
    };

    const handleJoined = () => {
      setSocketConnected(true);
      setPollingEnabled(false);
    };

    const handleNewNotification = (notification) => {
  setNotifications((current) =>
        mergeNotification(current, notification)
      );

      window.dispatchEvent(
        new CustomEvent("bnpl:new-notification", {
          detail: {
            notification,
            role,
          },
        })
      );
    };

    const handleRefresh = () => {
      loadNotifications({ silent: true });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("socket:joined", handleJoined);
    socket.on("notification:new", handleNewNotification);
    socket.on("notification:refresh", handleRefresh);

    if (socket.connected) {
      socket.emit("join_user_room", user.id);
      setSocketConnected(true);
      setPollingEnabled(false);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("socket:joined", handleJoined);
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:refresh", handleRefresh);
      disconnectUserSocket(user.id);
    };
  }, [loadNotifications, role]);

  return {
    notifications,
    loading,
    error,
    socketConnected,
    pollingEnabled,
    reload: loadNotifications,
    markRead,
    markAllRead,
  };
}

export function useCustomerNotifications() {
  return useNotificationsWithFallback({
    role: "CUSTOMER",
    fetchNotifications: getCustomerNotifications,
    markReadApi: markCustomerNotificationRead,
    markAllReadApi: markAllCustomerNotificationsRead,
  });
}

export function useOperatorNotifications() {
  return useNotificationsWithFallback({
    role: "OPERATOR",
    fetchNotifications: () => operatorService.getNotifications(),
    markReadApi: (id) => operatorService.markNotificationRead(id),
    markAllReadApi: () => operatorService.markAllNotificationsRead(),
  });
}

export function useMasterNotifications() {
  return useNotificationsWithFallback({
    role: "MASTER_SELLER",
    fetchNotifications: () => operatorService.getNotifications(),
    markReadApi: (id) => operatorService.markNotificationRead(id),
    markAllReadApi: () => operatorService.markAllNotificationsRead(),
  });
}