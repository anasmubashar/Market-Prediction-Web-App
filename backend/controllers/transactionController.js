const Transaction = require("../models/Transaction");
const Market = require("../models/Market");
const User = require("../models/User");
const Position = require("../models/Position");
const FixedMarketService = require("../services/fixedMarketService"); // Changed from lmsrService
const { validationResult } = require("express-validator");

// Get all transactions
exports.getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      marketId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (userId) query.user = userId;
    if (marketId) query.market = marketId;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const transactions = await Transaction.find(query)
      .populate("user", "email")
      .populate("market", "title")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create new transaction with fixed-odds pricing (BUY only)
exports.createTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userEmail, marketId, type, amount, outcome = "YES" } = req.body;

    // Only allow BUY transactions in fixed-odds markets
    if (type !== "BUY") {
      return res.status(400).json({
        message:
          "Only BUY transactions are allowed in fixed-odds markets. You cannot sell shares.",
      });
    }

    // Get market and user
    const market = await Market.findById(marketId);
    const user = await User.findOne({ email: userEmail });

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (market.status !== "active") {
      return res.status(400).json({ message: "Market is not active" });
    }

    if (new Date() > market.deadline) {
      return res.status(400).json({ message: "Market deadline has passed" });
    }

    // Get or create user position
    let position = await Position.findOne({ user: user._id, market: marketId });
    if (!position) {
      position = new Position({
        user: user._id,
        market: marketId,
        sharesYes: 0,
        sharesNo: 0,
        totalInvested: 0,
      });

      // Increase participant count for new users only
      market.participantCount = (market.participantCount || 0) + 1;
    }

    // Use fixed-odds service for buying
    const transactionResult = await FixedMarketService.buyFixedShares(
      user._id,
      marketId,
      outcome,
      amount
    );

    // Create transaction record
    const transaction = new Transaction({
      user: user._id,
      market: marketId,
      type: "BUY",
      amount: transactionResult.shares,
      price: transactionResult.probability,
      pointsChange: -transactionResult.cost,
      source: req.body.source || "web",
      notes: `BUY ${transactionResult.shares} ${outcome} shares at ${transactionResult.probability}%`,
    });

    // Update user stats
    user.stats.totalPredictions += 1;
    user.lastActive = new Date();

    // Save all changes
    await Promise.all([transaction.save(), market.save(), user.save()]);

    await transaction.populate(["user", "market"]);

    // Get updated market stats
    const marketStats = FixedMarketService.getMarketStats(market);

    // Get updated position
    const updatedPosition = await Position.findOne({
      user: user._id,
      market: marketId,
    });

    res.status(201).json({
      transaction,
      marketStats,
      userPosition: {
        sharesYes: updatedPosition.sharesYes,
        sharesNo: updatedPosition.sharesNo,
        totalInvested: updatedPosition.totalInvested,
        realizedPnL: updatedPosition.realizedPnL,
      },
      tradeDetails: {
        sharesTraded: transactionResult.shares,
        cost: transactionResult.cost,
        newPrice: transactionResult.probability,
        outcome,
      },
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user positions (updated to show only holdings, no selling value)
exports.getUserPositions = async (req, res) => {
  try {
    const { userEmail } = req.params;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const positions = await Position.find({ user: user._id }).populate(
      "market",
      "title currentProbability status deadline fixedYesPrice fixedNoPrice"
    );

    // Calculate potential payout for each position (no selling in fixed-odds)
    const positionsWithPayout = positions.map((position) => {
      const market = position.market;

      // Calculate potential payout if market resolves in user's favor
      let maxPayout = 0;
      if (position.sharesYes > 0) {
        maxPayout += position.sharesYes * 100; // Each YES share pays 100 points if YES wins
      }
      if (position.sharesNo > 0) {
        maxPayout += position.sharesNo * 100; // Each NO share pays 100 points if NO wins
      }

      const potentialProfit = maxPayout - position.totalInvested;

      return {
        ...position.toObject(),
        maxPayout: Math.round(maxPayout * 100) / 100,
        potentialProfit: Math.round(potentialProfit * 100) / 100,
        totalInvested: position.totalInvested,
      };
    });

    res.json(positionsWithPayout);
  } catch (error) {
    console.error("Get user positions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Process email-based transaction (BUY only)
exports.processEmailTransaction = async (req, res) => {
  try {
    const { userEmail, command, marketTitle, amount } = req.body;

    // Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find market by title (fuzzy match)
    const market = await Market.findOne({
      title: { $regex: marketTitle, $options: "i" },
      status: "active",
    });

    if (!market) {
      return res.status(404).json({ message: "Market not found or inactive" });
    }

    // Only allow BUY commands
    const type = command.toUpperCase();
    if (type !== "BUY") {
      return res
        .status(400)
        .json({
          message: "Only BUY commands are supported in fixed-odds markets",
        });
    }

    // Create transaction with email source
    const transactionData = {
      userEmail: user.email,
      marketId: market._id,
      type: "BUY",
      amount: Number.parseInt(amount),
      outcome: "YES", // Default to YES for email commands
      source: "email",
    };

    // Reuse the create transaction logic
    req.body = transactionData;
    return this.createTransaction(req, res);
  } catch (error) {
    console.error("Process email transaction error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
