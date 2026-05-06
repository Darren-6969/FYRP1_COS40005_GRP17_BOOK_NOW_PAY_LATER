import { Server } from "socket.io";

let io;

function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://newfrontbnplplatform.vercel.app",
  ].filter(Boolean);
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_user_room", (userId) => {
      if (!userId) return;

      const roomName = `user:${userId}`;
      socket.join(roomName);

      console.log(`Socket ${socket.id} joined ${roomName}`);

      socket.emit("socket:joined", {
        room: roomName,
      });
    });

    socket.on("leave_user_room", (userId) => {
      if (!userId) return;

      const roomName = `user:${userId}`;
      socket.leave(roomName);

      console.log(`Socket ${socket.id} left ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    return null;
  }

  return io;
}

export function emitToUser(userId, eventName, payload) {
  if (!io || !userId) return false;

  io.to(`user:${userId}`).emit(eventName, payload);
  return true;
}