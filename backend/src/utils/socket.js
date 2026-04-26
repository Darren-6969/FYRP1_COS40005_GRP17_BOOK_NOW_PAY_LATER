let io;

module.exports = {
    init: (httpServer) => {
        const { Server } = require('socket.io');
        io = new Server(httpServer, {
            cors: {
                origin: "*", // Update this to your frontend URL in production
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);

            // Optional: Join a specific room based on user ID so they only get their own alerts
            socket.on('join_user_room', (userId) => {
                socket.join(userId);
                console.log(`User ${userId} joined their personal notification room.`);
            });

            socket.on('disconnect', () => {
                console.log(`❌ Client disconnected: ${socket.id}`);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io has not been initialized!");
        }
        return io;
    }
};