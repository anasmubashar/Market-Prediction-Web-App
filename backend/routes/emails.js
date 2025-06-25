const express = require("express");
const { body } = require("express-validator");
const emailController = require("../controllers/emailController");

const router = express.Router();

// Send market cycle email
router.post("/send-market-cycle", emailController.sendMarketCycle);

// Get email cycles history
router.get("/cycles", emailController.getEmailCycles);

// Get single email cycle
router.get("/cycles/:id", emailController.getEmailCycle);

// Send custom email
router.post(
  "/send-custom",
  [
    body("userIds").isArray({ min: 1 }),
    body("subject").trim().isLength({ min: 5, max: 100 }),
    body("htmlContent").trim().isLength({ min: 10 }),
    body("textContent").trim().isLength({ min: 10 }),
  ],
  emailController.sendCustomEmail
);

router.post(
  "/schedule",
  [
    body("title").isString().isLength({ min: 5 }),
    body("markets").isArray({ min: 1 }),
    body("recurrence.frequency").isIn(["daily", "weekly", "monthly"]),
    body("recurrence.timeOfDay").matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
    body("recurrence.dayOfWeek").optional().isInt({ min: 0, max: 6 }),
    body("recurrence.dayOfMonth").optional().isInt({ min: 1, max: 31 }),
  ],
  emailController.scheduleEmailCycle
);

module.exports = router;
