const express = require("express");
const { body } = require("express-validator");
const adminController = require("../controllers/adminController");

const router = express.Router();

// Get dashboard statistics
router.get("/dashboard-stats", adminController.getDashboardStats);

// Export users as CSV
router.get("/export/users", adminController.exportUsers);

// Export transactions as CSV
// router.get("/export/transactions", adminController.exportTransactions);

// Excel export routes
router.get("/export/users", adminController.exportUsers);
router.get("/export/transactions", adminController.exportTransactions);
router.get("/export/markets", adminController.exportMarkets);

// Create admin user (for initial setup)
router.post(
  "/create-admin",
  [
    body("email").isEmail().normalizeEmail(),
    // body("name").trim().isLength({ min: 2, max: 50 }),
    body("password").isLength({ min: 6 }),
  ],
  adminController.createAdmin
);

module.exports = router;
