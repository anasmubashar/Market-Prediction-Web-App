const express = require("express")
const { body, query } = require("express-validator")
const marketController = require("../controllers/marketController")

const router = express.Router()

// Public routes
router.get("/", marketController.getMarkets)
router.get("/:id", marketController.getMarket)

// Get pricing info for potential trade
router.get(
  "/:id/pricing",
  [query("amount").isNumeric(), query("type").isIn(["BUY", "SELL"]), query("outcome").optional().isIn(["YES", "NO"])],
  marketController.getMarketPricing,
)

// Admin routes
router.post(
  "/",
  [
    body("title").trim().isLength({ min: 10, max: 200 }),
    body("deadline").isISO8601(),
    body("beta")
      .optional()
      .isNumeric()
      .custom((value) => value > 0),
  ],
  marketController.createMarket,
)

router.put(
  "/:id",
  [
    body("title").optional().trim().isLength({ min: 10, max: 200 }),
    body("deadline").optional().isISO8601(),
    body("beta")
      .optional()
      .isNumeric()
      .custom((value) => value > 0),
  ],
  marketController.updateMarket,
)

router.post("/:id/resolve", [body("outcome").isBoolean()], marketController.resolveMarket)


router.delete("/:id", marketController.deleteMarket)

module.exports = router
