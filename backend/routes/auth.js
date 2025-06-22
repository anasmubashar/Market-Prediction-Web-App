const express = require("express")
const { body } = require("express-validator")
const authController = require("../controllers/authController")

const router = express.Router()

// Register new user (simple email signup)
router.post(
  "/register",
  [body("email").isEmail().normalizeEmail(), body("name").trim().isLength({ min: 2, max: 50 })],
  authController.register,
)

module.exports = router
