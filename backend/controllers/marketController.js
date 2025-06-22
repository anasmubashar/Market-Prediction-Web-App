const Market = require("../models/Market")
const Transaction = require("../models/Transaction")
const Position = require("../models/Position")
const LMSRService = require("../services/lmsrService")
const { validationResult } = require("express-validator")

// Get all markets
exports.getMarkets = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query

    const query = {}
    if (status) query.status = status

    const markets = await Market.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    // Add LMSR stats to each market
    const marketsWithStats = markets.map((market) => {
      const stats = LMSRService.getMarketStats(market.lmsr.sharesYes, market.lmsr.sharesNo, market.lmsr.beta)

      return {
        ...market.toObject(),
        lmsrStats: stats,
      }
    })

    const total = await Market.countDocuments(query)

    res.json({
      markets: marketsWithStats,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    })
  } catch (error) {
    console.error("Get markets error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Get single market
exports.getMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id)

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    // Add LMSR stats
    const stats = LMSRService.getMarketStats(market.lmsr.sharesYes, market.lmsr.sharesNo, market.lmsr.beta)

    res.json({
      ...market.toObject(),
      lmsrStats: stats,
    })
  } catch (error) {
    console.error("Get market error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Create new market
exports.createMarket = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { title, description, deadline, tags, beta = 100 } = req.body

    // Initialize LMSR market
    const lmsrInit = LMSRService.initializeMarket(beta)

    const market = new Market({
      title,
      description,
      deadline: new Date(deadline),
      tags: tags || [],
      currentProbability: lmsrInit.initialPrice,
      lmsr: {
        beta,
        sharesYes: lmsrInit.qYes,
        sharesNo: lmsrInit.qNo,
        costFunction: LMSRService.calculateCostFunction(lmsrInit.qYes, lmsrInit.qNo, beta),
      },
      probabilityHistory: [
        {
          date: new Date(),
          probability: lmsrInit.initialPrice,
        },
      ],
    })

    await market.save()

    // Add LMSR stats to response
    const stats = LMSRService.getMarketStats(market.lmsr.sharesYes, market.lmsr.sharesNo, market.lmsr.beta)

    res.status(201).json({
      ...market.toObject(),
      lmsrStats: stats,
    })
  } catch (error) {
    console.error("Create market error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Update market
exports.updateMarket = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const market = await Market.findById(req.params.id)
    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    const { title, description, deadline, status, tags, beta } = req.body

    if (title) market.title = title
    if (description) market.description = description
    if (deadline) market.deadline = new Date(deadline)
    if (status) market.status = status
    if (tags) market.tags = tags
    if (beta && market.status === "active") {
      // Only allow beta changes for active markets with no trades
      const hasTransactions = await Transaction.countDocuments({ market: market._id })
      if (hasTransactions === 0) {
        market.lmsr.beta = beta
        market.lmsr.costFunction = LMSRService.calculateCostFunction(market.lmsr.sharesYes, market.lmsr.sharesNo, beta)
      }
    }

    await market.save()

    // Add LMSR stats to response
    const stats = LMSRService.getMarketStats(market.lmsr.sharesYes, market.lmsr.sharesNo, market.lmsr.beta)

    res.json({
      ...market.toObject(),
      lmsrStats: stats,
    })
  } catch (error) {
    console.error("Update market error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Resolve market
exports.resolveMarket = async (req, res) => {
  try {
    const { outcome, notes } = req.body

    const market = await Market.findById(req.params.id)
    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    if (market.status === "resolved") {
      return res.status(400).json({ message: "Market already resolved" })
    }

    market.status = "resolved"
    market.resolution = {
      outcome: outcome === "true" || outcome === true,
      resolvedAt: new Date(),
      notes: notes || "",
    }

    await market.save()

    // Calculate payouts for all positions
    const positions = await Position.find({ market: market._id }).populate("user")

    for (const position of positions) {
      let payout = 0

      if (market.resolution.outcome) {
        // YES outcome - YES shares pay out 1 point each
        payout = position.sharesYes
      } else {
        // NO outcome - NO shares pay out 1 point each
        payout = position.sharesNo
      }

      if (payout > 0) {
        // Add payout to user's points
        position.user.points += payout
        position.realizedPnL += payout
        await position.user.save()
        await position.save()
      }
    }

    res.json(market)
  } catch (error) {
    console.error("Resolve market error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Delete market
exports.deleteMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id)
    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    // Check if market has transactions
    const transactionCount = await Transaction.countDocuments({ market: market._id })
    if (transactionCount > 0) {
      return res.status(400).json({
        message: "Cannot delete market with existing transactions",
      })
    }

    await Market.findByIdAndDelete(req.params.id)
    res.json({ message: "Market deleted successfully" })
  } catch (error) {
    console.error("Delete market error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Get market pricing info for a potential trade
exports.getMarketPricing = async (req, res) => {
  try {
    const { amount, type, outcome = "YES" } = req.query
    const market = await Market.findById(req.params.id)

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    let result
    if (type === "BUY") {
      result = LMSRService.calculateSharesForBudget(
        market.lmsr.sharesYes,
        market.lmsr.sharesNo,
        Number.parseFloat(amount),
        outcome,
        market.lmsr.beta,
      )
    } else {
      result = LMSRService.calculateSellProceeds(
        market.lmsr.sharesYes,
        market.lmsr.sharesNo,
        Number.parseFloat(amount),
        outcome,
        market.lmsr.beta,
      )
    }

    res.json({
      currentPrice: market.currentProbability,
      tradeResult: result,
      marketStats: LMSRService.getMarketStats(market.lmsr.sharesYes, market.lmsr.sharesNo, market.lmsr.beta),
    })
  } catch (error) {
    console.error("Get market pricing error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
