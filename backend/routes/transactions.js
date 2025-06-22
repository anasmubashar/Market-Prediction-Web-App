const express = require("express")
const { body } = require("express-validator")
const transactionController = require("../controllers/transactionController")

const router = express.Router()

// Get all transactions
router.get("/", transactionController.getTransactions)

// Create new transaction
router.post(
  "/",
  [
    body("userEmail").isEmail().normalizeEmail(),
    body("marketId").isMongoId(),
    body("type").isIn(["BUY", "SELL"]),
    body("amount")
      .isNumeric()
      .custom((value) => value > 0),
    body("outcome").optional().isIn(["YES", "NO"]),
  ],
  transactionController.createTransaction,
)

// Get user positions
router.get("/positions/:userEmail", transactionController.getUserPositions)

// Process email-based transaction (internal use)
router.post("/email", transactionController.processEmailTransaction)

module.exports = router
