import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  acceptAlternativeBooking,
  cancelCustomerBooking,
  createCustomerBooking,
  getCustomerBookingActivity,
  getCustomerBookingById,
  getCustomerBookings,
  getCustomerInvoiceById,
  getCustomerInvoices,
  getCustomerNotifications,
  getCustomerPayments,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  payCustomerBooking,
  rejectAlternativeBooking,
  uploadCustomerReceipt,
} from "../controllers/customer_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import prisma from "../config/db.js";

const router = express.Router();

// ========== CONFIGURE MULTER ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter,
});

// ========== PROFILE IMAGE UPLOAD ENDPOINT ==========
router.post("/upload-profile-image", verifyToken, allowRoles("CUSTOMER"), (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || "File upload error" 
      });
    }
    
    try {
      console.log("=== Upload Request ===");
      console.log("User ID:", req.user?.id);
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "No image file provided" 
        });
      }
      
      const baseUrl = process.env.BASE_URL || "http://localhost:5000";
      const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;
      
      console.log("Image URL:", imageUrl);
      console.log("Updating user with profileImageUrl...");
      
      // Update the user with the new profile image URL
      await prisma.user.update({
        where: { id: req.user.id },
        data: { profileImageUrl: imageUrl },
      });
      
      console.log("Database update complete, fetching updated user...");
      
      // Fetch the updated user with ALL fields
      const updatedUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          phone: true,
          profileImageUrl: true,  // ← This is the key field
          role: true,
          createdAt: true,
          updatedAt: true,
          notifyBookingUpdates: true,
          notifyPaymentReminders: true,
          notifyInvoices: true,
          notifyPromotions: true,
        },
      });
      
      console.log("Updated user profileImageUrl:", updatedUser?.profileImageUrl);
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        user: updatedUser,
      });
      
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Error stack:", error.stack);
      
      // Even if database fails, return the image URL
      if (req.file) {
        const baseUrl = process.env.BASE_URL || "http://localhost:5000";
        const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;
        
        return res.json({
          success: true,
          imageUrl: imageUrl,
          warning: "Image uploaded but database update may have failed",
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to upload image" 
      });
    }
  });
});

// ========== STATIC FILE SERVING ==========
router.use("/uploads", express.static("uploads"));

// ========== EXISTING ROUTES ==========
router.get("/bookings", verifyToken, allowRoles("CUSTOMER"), getCustomerBookings);
router.post("/bookings", verifyToken, allowRoles("CUSTOMER"), createCustomerBooking);
router.get("/bookings/:id", verifyToken, allowRoles("CUSTOMER"), getCustomerBookingById);
router.patch("/bookings/:id/accept-alternative", verifyToken, allowRoles("CUSTOMER"), acceptAlternativeBooking);
router.patch("/bookings/:id/reject-alternative", verifyToken, allowRoles("CUSTOMER"), rejectAlternativeBooking);
router.patch("/bookings/:id/cancel", verifyToken, allowRoles("CUSTOMER"), cancelCustomerBooking);
router.get("/bookings/:id/activity", verifyToken, allowRoles("CUSTOMER"), getCustomerBookingActivity);

router.post("/bookings/:id/pay", verifyToken, allowRoles("CUSTOMER"), payCustomerBooking);
router.post("/bookings/:id/receipt", verifyToken, allowRoles("CUSTOMER"), uploadCustomerReceipt);

router.get("/payments", verifyToken, allowRoles("CUSTOMER"), getCustomerPayments);
router.get("/invoices", verifyToken, allowRoles("CUSTOMER"), getCustomerInvoices);
router.get("/invoices/:id", verifyToken, allowRoles("CUSTOMER"), getCustomerInvoiceById);

router.get("/notifications", verifyToken, allowRoles("CUSTOMER"), getCustomerNotifications);
router.patch("/notifications/read-all", verifyToken, allowRoles("CUSTOMER"), markAllCustomerNotificationsRead);
router.patch("/notifications/:id/read", verifyToken, allowRoles("CUSTOMER"), markCustomerNotificationRead);

export default router;