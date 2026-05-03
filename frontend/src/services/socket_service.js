import { io } from "socket.io-client";

let socket = null;

export function isRealtimeEnabled() {
  return import.meta.env.VITE_ENABLE_SOCKET === "true";
}

function getApiBaseUrl() {
  const rawBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api";

  return rawBaseUrl.replace(/\/api\/?$/, "");
}

export function getSocket() {
  if (!isRealtimeEnabled()) {
    return null;
  }

  if (!socket) {
    socket = io(getApiBaseUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: false,
    });
  }

  return socket;
}

export function connectUserSocket(userId) {
  if (!isRealtimeEnabled() || !userId) {
    return null;
  }

  const activeSocket = getSocket();
  if (!activeSocket) return null;

  if (!activeSocket.connected) {
    activeSocket.connect();
  }

  activeSocket.emit("join_user_room", userId);
  return activeSocket;
}

export function disconnectUserSocket(userId) {
  if (!socket) return;

  if (userId) {
    socket.emit("leave_user_room", userId);
  }

  socket.disconnect();
}

export function onSocketEvent(eventName, handler) {
  const activeSocket = getSocket();

  if (!activeSocket) {
    return () => {};
  }

  activeSocket.on(eventName, handler);

  return () => {
    activeSocket.off(eventName, handler);
  };
}