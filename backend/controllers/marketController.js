const Market = require("../models/Market");
const Transaction = require("../models/Transaction");
const Position = require("../models/Position");
const FixedMarketService = require("../services/fixedMarketService");
const MarketService = require("../services/marketService");
const { validationResult } = require("express-validator");

// Get all markets - FIXED VERSION
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

      // Use the volume stats from the service for consistency
      const volumeStats = FixedMarketService.getVolumeStats(market);

      console.log(`📊 Market ${market.title} - Volume Stats:`, volumeStats);
      console.log(
        `👤 Market ${market.title} - Participants: ${market.participantCount}`
      );

      return {
        ...market.toObject(),
        fixedOddsStats: stats,
        timeStatus,
        currentProbability: volumeStats.yesPercentage, // Use consistent calculation
        volumeStats, // Include volume stats for debugging
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

// Get single market - FIXED VERSION
exports.getMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    // Add fixed-odds stats and time status
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    // Use the volume stats from the service for consistency
    const volumeStats = FixedMarketService.getVolumeStats(market);

    console.log(
      `📊 Single Market ${market.title} - Volume Stats:`,
      volumeStats
    );
    console.log(
      `👤 Single Market ${market.title} - Participants: ${market.participantCount}`
    );
    console.log(
      `📊 Raw market data - yesVolume: ${market.yesVolume}, noVolume: ${market.noVolume}, totalVolume: ${market.totalVolume}`
    );

    res.json({
      ...market.toObject(),
      fixedOddsStats: stats,
      timeStatus,
      currentProbability: volumeStats.yesPercentage, // Use consistent calculation
      volumeStats, // Include volume stats for debugging
    });
  } catch (error) {
    console.error("Get market error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add utility endpoint to fix participant counts for existing markets
exports.fixParticipantCounts = async (req, res) => {
  try {
    const markets = await Market.find({});
    const results = [];

    for (const market of markets) {
      const actualCount = await FixedMarketService.recalculateParticipantCount(
        market._id
      );
      results.push({
        marketId: market._id,
        title: market.title,
        oldCount: market.participantCount,
        newCount: actualCount,
      });
    }

    res.json({
      message: "Participant counts recalculated",
      results,
    });
  } catch (error) {
    console.error("Fix participant counts error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get volume chart data for a specific market - FIXED VERSION
exports.getVolumeChartData = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);

    if (!market) {
      return res.status(404).json({ message: "Market not found" });
    }

    console.log(`📊 Chart Data Request for ${market.title}`);
    console.log(
      `📊 Raw market volumes - YES: ${market.yesVolume}, NO: ${market.noVolume}, Total: ${market.totalVolume}`
    );
    console.log(`👤 Market participants: ${market.participantCount}`);

    // Get current volume stats for consistency
    const currentVolumeStats = FixedMarketService.getVolumeStats(market);
    console.log(`📊 Current volume stats:`, currentVolumeStats);

    // Get volume history or create default data
    let chartData = [];

    if (market.volumeHistory && market.volumeHistory.length > 0) {
      // Use existing volume history but recalculate percentages to ensure consistency
      chartData = market.volumeHistory.map((entry) => {
        const entryTotal = (entry.yesVolume || 0) + (entry.noVolume || 0);
        const recalculatedYesPercentage =
          entryTotal > 0
            ? Math.round(((entry.yesVolume || 0) / entryTotal) * 100)
            : 50;
        const recalculatedNoPercentage =
          entryTotal > 0
            ? Math.round(((entry.noVolume || 0) / entryTotal) * 100)
            : 50;

        console.log(
          `📊 History entry - YES: ${entry.yesVolume}, NO: ${entry.noVolume}, Total: ${entryTotal}`
        );
        console.log(
          `📊 Recalculated - YES: ${recalculatedYesPercentage}%, NO: ${recalculatedNoPercentage}%`
        );

        return {
          date: entry.date,
          yesPercentage: recalculatedYesPercentage,
          noPercentage: recalculatedNoPercentage,
        };
      });
    } else {
      // Create default data points if no volume history exists
      const now = new Date();
      const yesVolume = market.yesVolume || 0;
      const noVolume = market.noVolume || 0;
      const totalVolume = yesVolume + noVolume;

      console.log(
        `📊 Creating default chart data - YES: ${yesVolume}, NO: ${noVolume}, Total: ${totalVolume}`
      );

      if (totalVolume > 0) {
        const yesPercentage = Math.round((yesVolume / totalVolume) * 100);
        const noPercentage = Math.round((noVolume / totalVolume) * 100);

        console.log(
          `📊 Default percentages - YES: ${yesPercentage}%, NO: ${noPercentage}%`
        );

        // Create a few data points for visualization
        for (let i = 3; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000); // 1 hour intervals
          chartData.push({
            date: date.toISOString(),
            yesPercentage,
            noPercentage,
          });
        }
      } else {
        // No volume data - create flat line at 50%
        for (let i = 3; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000);
          chartData.push({
            date: date.toISOString(),
            yesPercentage: 50,
            noPercentage: 50,
          });
        }
      }
    }

    console.log(`📊 Final chart data:`, chartData);

    res.json({
      chartData,
      marketStats: {
        yesVolume: market.yesVolume || 0,
        noVolume: market.noVolume || 0,
        totalVolume: market.totalVolume || 0,
        yesPercentage: currentVolumeStats.yesPercentage,
        noPercentage: currentVolumeStats.noPercentage,
        participantCount: market.participantCount || 0, // Include participant count
      },
    });
  } catch (error) {
    console.error("Get volume chart data error:", error);
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
      currentProbability: 50, // Start at 50%, will be updated based on volume
      yesVolume: 0, // Initialize volumes
      noVolume: 0,
      totalVolume: 0,
      participantCount: 0, // Initialize participant count
      probabilityHistory: [
        {
          date: new Date(),
          probability: 50,
        },
      ],
    });

    await market.save();

    // Add fixed-odds stats to response
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    console.log(
      `🆕 Created new market "${title}" with participant count: ${market.participantCount}`
    );

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
    }
    if (fixedNoPrice !== undefined) {
      market.fixedNoPrice = fixedNoPrice;
    }

    // Update currentProbability based on volume, not fixed price
    const volumeStats = FixedMarketService.getVolumeStats(market);
    market.currentProbability = volumeStats.yesPercentage;

    await market.save();

    // Add fixed-odds stats to response
    const stats = FixedMarketService.getMarketStats(market);
    const timeStatus = MarketService.getMarketTimeStatus(market);

    console.log(
      `📝 Updated market "${market.title}" - Participants: ${market.participantCount}`
    );

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

    // Convert string outcomes to boolean for the MarketService
    let booleanOutcome;
    if (outcome === "YES" || outcome === "true" || outcome === true) {
      booleanOutcome = true;
    } else if (outcome === "NO" || outcome === "false" || outcome === false) {
      booleanOutcome = false;
    } else {
      return res
        .status(400)
        .json({ message: "Invalid outcome. Must be YES, NO, true, or false" });
    }

    const market = await MarketService.resolveMarket(
      req.params.id,
      booleanOutcome,
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

    // Use volume stats for current probability
    const volumeStats = FixedMarketService.getVolumeStats(market);

    res.json({
      currentPrice: volumeStats.yesPercentage, // Show YES volume percentage
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
