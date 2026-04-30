import express from "express";
import {
  createHostBooking,
} from "../controllers/host_controller.js";

const router = express.Router();

router.post("/bookings", createHostBooking);

export default router;