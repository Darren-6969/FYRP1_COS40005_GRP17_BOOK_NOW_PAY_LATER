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
  getSocket,
} from "../services/socket_service";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
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

function useRealtimeNotifications({ role, fetchNotifications, markReadApi, markAllReadApi }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetchNotifications();

      const payload = res.data?.notifications || res.data || [];
      setNotifications(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications]);

  const markRead = async (id) => {
    await markReadApi(id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              isRead: true,
            }
          : item
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

  useEffect(() => {
    const user = getStoredUser();

    if (!user?.id) return;

    const socket = connectUserSocket(user.id);

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit("join_user_room", user.id);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleJoined = () => {
      setSocketConnected(true);
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
      loadNotifications();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("socket:joined", handleJoined);
    socket.on("notification:new", handleNewNotification);
    socket.on("notification:refresh", handleRefresh);

    if (socket.connected) {
      socket.emit("join_user_room", user.id);
      setSocketConnected(true);
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
    reload: loadNotifications,
    markRead,
    markAllRead,
  };
}

export function useCustomerNotifications() {
  return useRealtimeNotifications({
    role: "CUSTOMER",
    fetchNotifications: getCustomerNotifications,
    markReadApi: markCustomerNotificationRead,
    markAllReadApi: markAllCustomerNotificationsRead,
  });
}

export function useOperatorNotifications() {
  return useRealtimeNotifications({
    role: "OPERATOR",
    fetchNotifications: () => operatorService.getNotifications(),
    markReadApi: (id) => operatorService.markNotificationRead(id),
    markAllReadApi: () => operatorService.markAllNotificationsRead(),
  });
}