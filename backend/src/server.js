import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`BNPL backend running on http://localhost:${PORT}`);
  console.log("Socket.IO real-time notification server is active");
});