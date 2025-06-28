const Market = require("../models/Market");
const Transaction = require("../models/Transaction");
const Position = require("../models/Position");
const FixedMarketService = require("../services/fixedMarketService");
const MarketService = require("../services/marketService");
const { validationResult } = require("express-validator");

// Get all markets
exports.getMarkets = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;

    const markets = await Market.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add fixed-odds stats and time status to each market
    const marketsWithStats = markets.map((market) => {
      const stats = FixedMarketService.getMarketStats(market);
      const timeStatus = MarketService.getMarketTimeStatus(market);

      return {
        ...market.toObject(),
        fixedOddsStats: stats,
        timeStatus,
      };
    });

    const total = await Market.countDocuments(query);

    res.json({
      markets: marketsWithStats,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get markets error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single market
exports.getMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    // Add fixed-odds stats and time status
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    res.json({
      ...market.toObject(),
      fixedOddsStats: stats,
      timeStatus,
    });
  } catch (error) {
    console.error("Get market error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create new market
exports.createMarket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      deadline,
      tags,
      fixedYesPrice = 0.5,
      fixedNoPrice = 0.5,
    } = req.body;

    const market = new Market({
      title,
      description,
      deadline: new Date(deadline),
      tags: tags || [],
      fixedYesPrice,
      fixedNoPrice,
      currentProbability: Math.round(fixedYesPrice * 100),
      probabilityHistory: [
        {
          date: new Date(),
          probability: Math.round(fixedYesPrice * 100),
        },
      ],
    });

    await market.save();

    // Add fixed-odds stats to response
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    res.status(201).json({
      ...market.toObject(),
      fixedOddsStats: stats,
      timeStatus,
    });
  } catch (error) {
    console.error("Create market error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update market
exports.updateMarket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const market = await Market.findById(req.params.id);
    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    const {
      title,
      description,
      deadline,
      status,
      tags,
      fixedYesPrice,
      fixedNoPrice,
    } = req.body;

    if (title) market.title = title;
    if (description) market.description = description;
    if (deadline) market.deadline = new Date(deadline);
    if (status) market.status = status;
    if (tags) market.tags = tags;

    // Update fixed-odds prices
    if (fixedYesPrice !== undefined) {
      market.fixedYesPrice = fixedYesPrice;
      market.currentProbability = Math.round(fixedYesPrice * 100);
    }
    if (fixedNoPrice !== undefined) {
      market.fixedNoPrice = fixedNoPrice;
    }

    await market.save();

    // Add fixed-odds stats to response
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    res.json({
      ...market.toObject(),
      fixedOddsStats: stats,
      timeStatus,
    });
  } catch (error) {
    console.error("Update market error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Close expired markets
exports.closeExpiredMarkets = async (req, res) => {
  try {
    const closedCount = await MarketService.closeExpiredMarkets();

    res.json({
      message: `Closed ${closedCount} expired markets`,
      closedCount,
    });
  } catch (error) {
    console.error("Close expired markets error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Resolve market
exports.resolveMarket = async (req, res) => {
  try {
    const { outcome, notes } = req.body;

    const market = await MarketService.resolveMarket(
      req.params.id,
      outcome,
      notes
    );

    res.json(market);
  } catch (error) {
    console.error("Resolve market error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete market
exports.deleteMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);
    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    // Check if market has transactions
    const transactionCount = await Transaction.countDocuments({
      market: market._id,
    });
    if (transactionCount > 0) {
      return res.status(400).json({
        message: "Cannot delete market with existing transactions",
      });
    }

    await Market.findByIdAndDelete(req.params.id);
    res.json({ message: "Market deleted successfully" });
  } catch (error) {
    console.error("Delete market error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get market pricing info for a potential trade (BUY only)
exports.getMarketPricing = async (req, res) => {
  try {
    const { amount, outcome = "YES" } = req.query;
    const market = await Market.findById(req.params.id);

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    // Check if market is still active for trading
    const timeStatus = MarketService.getMarketTimeStatus(market);
    if (timeStatus.timeRemaining <= 0 && market.status === "active") {
      return res.status(400).json({
        message: "Market deadline has passed. Trading is closed.",
        timeStatus,
      });
    }

    const price =
      outcome === "YES" ? market.fixedYesPrice : market.fixedNoPrice;
    const result = FixedMarketService.calculateSharesForBudget(
      Number.parseFloat(amount),
      price
    );

    res.json({
      currentPrice: market.currentProbability,
      tradeResult: result,
      marketStats: FixedMarketService.getMarketStats(market),
      timeStatus,
      note: "Fixed-odds markets only support BUY operations. Shares pay out 100 points each if correct.",
    });
  } catch (error) {
    console.error("Get market pricing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
