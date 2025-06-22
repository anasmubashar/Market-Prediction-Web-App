const express = require("express")
const { body } = require("express-validator")
const emailController = require("../controllers/emailController")

const router = express.Router()

// Send market cycle email
router.post("/send-market-cycle", emailController.sendMarketCycle)

// Get email cycles history
router.get("/cycles", emailController.getEmailCycles)

// Get single email cycle
router.get("/cycles/:id", emailController.getEmailCycle)

// Send custom email
router.post(
  "/send-custom",
  [
    body("userIds").isArray({ min: 1 }),
    body("subject").trim().isLength({ min: 5, max: 100 }),
    body("htmlContent").trim().isLength({ min: 10 }),
    body("textContent").trim().isLength({ min: 10 }),
  ],
  emailController.sendCustomEmail,
)

module.exports = router
