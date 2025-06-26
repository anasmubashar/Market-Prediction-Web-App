const Transaction = require("../models/Transaction");
const Market = require("../models/Market");
const User = require("../models/User");
const Position = require("../models/Position");
const LMSRService = require("../services/lmsrService");
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

// Create new transaction with LMSR pricing
exports.createTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userEmail, marketId, type, amount, outcome = "YES" } = req.body;

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
      market.participants = (market.participants || 0) + 1;
    }

    let transactionResult;
    let pointsChange;
    let sharesTraded;
    let newPrice;

    if (type === "BUY") {
      // Calculate shares that can be bought with the amount
      transactionResult = LMSRService.calculateSharesForBudget(
        market.lmsr.sharesYes,
        market.lmsr.sharesNo,
        amount,
        outcome,
        market.lmsr.beta
      );

      sharesTraded = transactionResult.shares;
      pointsChange = -transactionResult.cost;
      newPrice = transactionResult.newPrice;

      // Check if user has enough points
      if (user.points < transactionResult.cost) {
        return res.status(400).json({
          message: "Insufficient points",
          required: transactionResult.cost,
          available: user.points,
        });
      }

      // Update market shares
      if (outcome === "YES") {
        market.lmsr.sharesYes += sharesTraded;
        position.sharesYes += sharesTraded;
      } else {
        market.lmsr.sharesNo += sharesTraded;
        position.sharesNo += sharesTraded;
      }

      position.totalInvested += transactionResult.cost;
    } else if (type === "SELL") {
      // Check if user has enough shares to sell
      const userShares =
        outcome === "YES" ? position.sharesYes : position.sharesNo;
      if (userShares < amount) {
        return res.status(400).json({
          message: "Insufficient shares to sell",
          requested: amount,
          available: userShares,
        });
      }

      // Calculate proceeds from selling
      transactionResult = LMSRService.calculateSellProceeds(
        market.lmsr.sharesYes,
        market.lmsr.sharesNo,
        amount,
        outcome,
        market.lmsr.beta
      );

      sharesTraded = amount;
      pointsChange = transactionResult.proceeds;
      newPrice = transactionResult.newPrice;

      // Update market shares
      if (outcome === "YES") {
        market.lmsr.sharesYes -= sharesTraded;
        position.sharesYes -= sharesTraded;
      } else {
        market.lmsr.sharesNo -= sharesTraded;
        position.sharesNo -= sharesTraded;
      }

      position.realizedPnL += transactionResult.proceeds;
    }

    // Update market probability and cost function
    market.currentProbability = newPrice;
    market.lmsr.costFunction = LMSRService.calculateCostFunction(
      market.lmsr.sharesYes,
      market.lmsr.sharesNo,
      market.lmsr.beta
    );
    market.totalVolume += Math.abs(pointsChange);

    // Create transaction record
    const transaction = new Transaction({
      user: user._id,
      market: marketId,
      type,
      amount: sharesTraded,
      price: newPrice,
      pointsChange,
      source: req.body.source || "web",
      notes: `${type} ${sharesTraded} ${outcome} shares at ${newPrice}%`,
    });

    // Update user points and stats
    user.points += pointsChange;
    user.stats.totalPredictions += 1;
    user.lastActive = new Date();

    // Save all changes
    await Promise.all([
      transaction.save(),
      market.save(),
      position.save(),
      user.save(),
    ]);

    await transaction.populate(["user", "market"]);

    // Get updated market stats
    const marketStats = LMSRService.getMarketStats(
      market.lmsr.sharesYes,
      market.lmsr.sharesNo,
      market.lmsr.beta
    );

    res.status(201).json({
      transaction,
      marketStats,
      userPosition: {
        sharesYes: position.sharesYes,
        sharesNo: position.sharesNo,
        totalInvested: position.totalInvested,
        realizedPnL: position.realizedPnL,
      },
      tradeDetails: {
        sharesTraded,
        costOrProceeds: Math.abs(pointsChange),
        newPrice,
        outcome,
      },
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user positions
exports.getUserPositions = async (req, res) => {
  try {
    const { userEmail } = req.params;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const positions = await Position.find({ user: user._id }).populate(
      "market",
      "title currentProbability status deadline"
    );

    // Calculate unrealized P&L for each position
    const positionsWithPnL = await Promise.all(
      positions.map(async (position) => {
        const market = position.market;

        // Calculate current value of holdings
        let currentValue = 0;
        if (position.sharesYes > 0) {
          const sellResult = LMSRService.calculateSellProceeds(
            market.lmsr.sharesYes,
            market.lmsr.sharesNo,
            position.sharesYes,
            "YES",
            market.lmsr.beta
          );
          currentValue += sellResult.proceeds;
        }
        if (position.sharesNo > 0) {
          const sellResult = LMSRService.calculateSellProceeds(
            market.lmsr.sharesYes,
            market.lmsr.sharesNo,
            position.sharesNo,
            "NO",
            market.lmsr.beta
          );
          currentValue += sellResult.proceeds;
        }

        const unrealizedPnL =
          currentValue - position.totalInvested + position.realizedPnL;

        return {
          ...position.toObject(),
          currentValue: Math.round(currentValue * 100) / 100,
          unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
          totalPnL:
            Math.round((unrealizedPnL + position.realizedPnL) * 100) / 100,
        };
      })
    );

    res.json(positionsWithPnL);
  } catch (error) {
    console.error("Get user positions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Process email-based transaction
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

    // Parse command (BUY/SELL)
    const type = command.toUpperCase();
    if (!["BUY", "SELL"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Invalid command. Use BUY or SELL" });
    }

    // Create transaction with email source
    const transactionData = {
      userEmail: user.email,
      marketId: market._id,
      type,
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
