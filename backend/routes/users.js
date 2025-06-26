const express = require("express");
const { body } = require("express-validator");
const userController = require("../controllers/userController");

const router = express.Router();

// Get all users
router.get("/", userController.getAllUsers);

// Get user statistics
router.get("/stats", userController.getUserStats);

// Get single user
router.get("/:id", userController.getUser);

// Update user
router.put(
  "/:id",
  [
    // body("name").optional().trim().isLength({ min: 2, max: 50 }),
    body("points").optional().isNumeric(),
    body("isActive").optional().isBoolean(),
  ],
  userController.updateUser
);

// Delete user
router.delete("/:id", userController.deleteUser);

// Bulk update users
router.post("/bulk-update", userController.bulkUpdateUsers);

module.exports = router;
