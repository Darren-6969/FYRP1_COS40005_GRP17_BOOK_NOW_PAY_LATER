import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "https://newfrontbnplplatform.vercel.app",
  ].filter(Boolean);
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: getAllowedOrigins(), methods: ["GET", "POST"], credentials: true },
  });

  // F1: authenticate every connection with the JWT access token.
  io.use((socket, next) => {
    try {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!raw) return next(new Error("Unauthorized: missing token"));

      const decoded = jwt.verify(raw, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch {
      return next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Bind strictly to the authenticated user's own room. Client-supplied ids are ignored.
    const roomName = `user:${socket.userId}`;
    socket.join(roomName);
    socket.emit("socket:joined", { room: roomName });

    // Kept for frontend compatibility, but the payload is ignored.
    socket.on("join_user_room", () => {
      socket.join(roomName);
      socket.emit("socket:joined", { room: roomName });
    });

    socket.on("leave_user_room", () => {
      socket.leave(roomName);
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO() {
  return io || null;
}

export function emitToUser(userId, eventName, payload) {
  if (!io || !userId) return false;
  io.to(`user:${userId}`).emit(eventName, payload);
  return true;
}