import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth_routes.js";
import dashboardRoutes from "./routes/dashboard_routes.js";
import bookingRoutes from "./routes/booking_routes.js";
import paymentRoutes from "./routes/payment_routes.js";
import receiptRoutes from "./routes/receipt_routes.js";
import invoiceRoutes from "./routes/invoice_routes.js";
import operatorRoutes from "./routes/operator_routes.js";
import configRoutes from "./routes/config_routes.js";
import logRoutes from "./routes/log_routes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "BNPL API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/config", configRoutes);
app.use("/api/logs", logRoutes);

app.use(errorHandler);

export default app;