const User = require("../models/User");
const Market = require("../models/Market");
const Transaction = require("../models/Transaction");
const EmailCycle = require("../models/EmailCycle");
const Position = require("../models/Position");
const XLSX = require("xlsx");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments({});
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });

    // Market statistics
    const totalMarkets = await Market.countDocuments();
    const activeMarkets = await Market.countDocuments({ status: "active" });
    const resolvedMarkets = await Market.countDocuments({ status: "resolved" });

    // Transaction statistics
    const totalTransactions = await Transaction.countDocuments();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTransactions = await Transaction.countDocuments({
      createdAt: { $gte: todayStart },
    });

    // Email statistics
    const totalEmailCycles = await EmailCycle.countDocuments();
    const lastEmailCycle = await EmailCycle.findOne().sort({ createdAt: -1 });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    const recentTransactions = await Transaction.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        recent: recentUsers,
      },
      markets: {
        total: totalMarkets,
        active: activeMarkets,
        resolved: resolvedMarkets,
      },
      transactions: {
        total: totalTransactions,
        today: todayTransactions,
        recent: recentTransactions,
      },
      emails: {
        totalCycles: totalEmailCycles,
        lastCycle: lastEmailCycle
          ? {
              date: lastEmailCycle.createdAt,
              sent: lastEmailCycle.stats.sent,
              failed: lastEmailCycle.stats.failed,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Export user data as Excel with multiple sheets
exports.exportUsers = async (req, res) => {
  try {
    console.log("📊 Starting user data export...");

    // Get all users with their positions
    const users = await User.find({}).select("-password -verificationToken");
    const positions = await Position.find({}).populate(
      "market",
      "title status"
    );

    // Create user summary data
    const userSummaryData = users.map((user) => {
      const userPositions = positions.filter(
        (pos) => pos.user.toString() === user._id.toString()
      );
      const totalInvested = userPositions.reduce(
        (sum, pos) => sum + (pos.totalInvested || 0),
        0
      );
      const activePositions = userPositions.filter(
        (pos) => pos.market.status === "active"
      ).length;
      const resolvedPositions = userPositions.filter(
        (pos) => pos.market.status === "resolved"
      ).length;

      return {
        Email: user.email,
        Points: user.points,
        "Total Predictions": user.stats.totalPredictions,
        "Correct Predictions": user.stats.correctPredictions,
        "Total Invested": totalInvested,
        "Active Positions": activePositions,
        "Resolved Positions": resolvedPositions,
        "Join Date": user.createdAt.toISOString().split("T")[0],
        "Last Active": user.lastActive.toISOString().split("T")[0],
        Status: user.isActive ? "Active" : "Inactive",
        "Email Notifications": user.preferences.emailNotifications
          ? "Yes"
          : "No",
        "Market Updates": user.preferences.marketUpdates ? "Yes" : "No",
      };
    });

    // Create detailed positions data
    const positionsData = positions.map((position) => ({
      "User Email": position.user.email || "Unknown",
      "Market Title": position.market.title,
      "Market Status": position.market.status,
      "YES Shares": position.sharesYes,
      "NO Shares": position.sharesNo,
      "Total Invested": position.totalInvested,
      "Realized P&L": position.realizedPnL || 0,
      "Created Date": position.createdAt.toISOString().split("T")[0],
      "Updated Date": position.updatedAt.toISOString().split("T")[0],
    }));

    // Create user statistics summary
    const statsData = [
      { Metric: "Total Users", Value: users.length },
      { Metric: "Active Users", Value: users.filter((u) => u.isActive).length },
      {
        Metric: "Users with Email Notifications",
        Value: users.filter((u) => u.preferences.emailNotifications).length,
      },
      {
        Metric: "Average Points per User",
        Value: Math.round(
          users.reduce((sum, u) => sum + u.points, 0) / users.length
        ),
      },
      {
        Metric: "Average Accuracy",
        Value: `${Math.round(
          users.reduce((sum, u) => sum + u.stats.accuracy, 0) / users.length
        )}%`,
      },
      {
        Metric: "Total Predictions Made",
        Value: users.reduce((sum, u) => sum + u.stats.totalPredictions, 0),
      },
      { Metric: "Total Positions", Value: positions.length },
      {
        Metric: "Total Amount Invested",
        Value: positions.reduce((sum, p) => sum + (p.totalInvested || 0), 0),
      },
    ];

    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();

    // Add User Summary sheet
    const userSummarySheet = XLSX.utils.json_to_sheet(userSummaryData);
    XLSX.utils.book_append_sheet(workbook, userSummarySheet, "User Summary");

    // Add Positions sheet
    const positionsSheet = XLSX.utils.json_to_sheet(positionsData);
    XLSX.utils.book_append_sheet(workbook, positionsSheet, "User Positions");

    // Add Statistics sheet
    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistics");

    // Set column widths for better readability
    const userSummarySheetRef = workbook.Sheets["User Summary"];
    userSummarySheetRef["!cols"] = [
      { wch: 25 }, // Email
      { wch: 10 }, // Points
      { wch: 15 }, // Total Predictions
      { wch: 15 }, // Correct Predictions
      { wch: 15 }, // Total Invested
      { wch: 15 }, // Active Positions
      { wch: 15 }, // Resolved Positions
      { wch: 12 }, // Join Date
      { wch: 12 }, // Last Active
      { wch: 10 }, // Status
      { wch: 18 }, // Email Notifications
      { wch: 15 }, // Market Updates
    ];

    const positionsSheetRef = workbook.Sheets["User Positions"];
    positionsSheetRef["!cols"] = [
      { wch: 25 }, // User Email
      { wch: 40 }, // Market Title
      { wch: 12 }, // Market Status
      { wch: 12 }, // YES Shares
      { wch: 12 }, // NO Shares
      { wch: 15 }, // Total Invested
      { wch: 15 }, // Realized P&L
      { wch: 12 }, // Created Date
      { wch: 12 }, // Updated Date
    ];

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=users_export_${timestamp}.xlsx`
    );

    console.log(
      `📊 User export completed: ${users.length} users, ${positions.length} positions`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export users error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Export transaction data as Excel with multiple sheets
exports.exportTransactions = async (req, res) => {
  try {
    console.log("📊 Starting transaction data export...");

    // Get all transactions with populated user and market data
    const transactions = await Transaction.find()
      .populate("user", "email")
      .populate("market", "title status")
      .sort({ createdAt: -1 });

    // Create detailed transaction data
    const transactionData = transactions.map((tx) => ({
      "Transaction ID": tx._id.toString(),
      "User Email": tx.user?.email || "Unknown",
      "Market Title": tx.market?.title || "Unknown Market",
      "Market Status": tx.market?.status || "Unknown",
      Type: tx.type,
      "Shares/Amount": tx.amount,
      "Price (%)": tx.price,
      "Points Change": tx.pointsChange,
      Source: tx.source,
      Notes: tx.notes || "",
      "Email Message ID": tx.emailMessageId || "",
      "Transaction Date": tx.createdAt.toISOString().split("T")[0],
      "Transaction Time": tx.createdAt.toTimeString().split(" ")[0],
      "Full Timestamp": tx.createdAt.toISOString(),
    }));

    // Create transaction summary by user
    const userTransactionSummary = {};
    transactions.forEach((tx) => {
      const email = tx.user?.email || "Unknown";
      if (!userTransactionSummary[email]) {
        userTransactionSummary[email] = {
          "User Email": email,
          "Total Transactions": 0,
          "BUY Transactions": 0,
          "SELL Transactions": 0,
          "Total Points Spent": 0,
          "Total Points Gained": 0,
          "Net Points Change": 0,
          "Email Transactions": 0,
          "Web Transactions": 0,
          "First Transaction": tx.createdAt,
          "Last Transaction": tx.createdAt,
        };
      }

      const summary = userTransactionSummary[email];
      summary["Total Transactions"]++;
      summary[`${tx.type} Transactions`]++;

      if (tx.pointsChange < 0) {
        summary["Total Points Spent"] += Math.abs(tx.pointsChange);
      } else {
        summary["Total Points Gained"] += tx.pointsChange;
      }

      summary["Net Points Change"] += tx.pointsChange;
      summary[`${tx.source === "email" ? "Email" : "Web"} Transactions`]++;

      if (tx.createdAt < summary["First Transaction"]) {
        summary["First Transaction"] = tx.createdAt;
      }
      if (tx.createdAt > summary["Last Transaction"]) {
        summary["Last Transaction"] = tx.createdAt;
      }
    });

    // Convert user summary to array and format dates
    const userSummaryData = Object.values(userTransactionSummary).map(
      (summary) => ({
        ...summary,
        "First Transaction": summary["First Transaction"]
          .toISOString()
          .split("T")[0],
        "Last Transaction": summary["Last Transaction"]
          .toISOString()
          .split("T")[0],
      })
    );

    // Create market transaction summary
    const marketTransactionSummary = {};
    transactions.forEach((tx) => {
      const marketTitle = tx.market?.title || "Unknown Market";
      if (!marketTransactionSummary[marketTitle]) {
        marketTransactionSummary[marketTitle] = {
          "Market Title": marketTitle,
          "Market Status": tx.market?.status || "Unknown",
          "Total Transactions": 0,
          "Unique Participants": new Set(),
          "Total Volume": 0,
          "BUY Transactions": 0,
          "SELL Transactions": 0,
          "Email Source": 0,
          "Web Source": 0,
        };
      }

      const summary = marketTransactionSummary[marketTitle];
      summary["Total Transactions"]++;
      summary["Unique Participants"].add(tx.user?.email || "Unknown");
      summary["Total Volume"] += Math.abs(tx.pointsChange);
      summary[`${tx.type} Transactions`]++;
      summary[`${tx.source === "email" ? "Email" : "Web"} Source`]++;
    });

    // Convert market summary to array and convert Set to count
    const marketSummaryData = Object.values(marketTransactionSummary).map(
      (summary) => ({
        ...summary,
        "Unique Participants": summary["Unique Participants"].size,
      })
    );

    // Create overall statistics
    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce(
      (sum, tx) => sum + Math.abs(tx.pointsChange),
      0
    );
    const uniqueUsers = new Set(transactions.map((tx) => tx.user?.email)).size;
    const uniqueMarkets = new Set(transactions.map((tx) => tx.market?.title))
      .size;

    const overallStats = [
      { Metric: "Total Transactions", Value: totalTransactions },
      { Metric: "Total Volume (Points)", Value: totalVolume },
      { Metric: "Unique Users", Value: uniqueUsers },
      { Metric: "Unique Markets", Value: uniqueMarkets },
      {
        Metric: "BUY Transactions",
        Value: transactions.filter((tx) => tx.type === "BUY").length,
      },
      {
        Metric: "SELL Transactions",
        Value: transactions.filter((tx) => tx.type === "SELL").length,
      },
      {
        Metric: "Email Transactions",
        Value: transactions.filter((tx) => tx.source === "email").length,
      },
      {
        Metric: "Web Transactions",
        Value: transactions.filter((tx) => tx.source === "web").length,
      },
      {
        Metric: "Average Transaction Size",
        Value: Math.round(totalVolume / totalTransactions),
      },
    ];

    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();

    // Add All Transactions sheet
    const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.book_append_sheet(
      workbook,
      transactionSheet,
      "All Transactions"
    );

    // Add User Summary sheet
    const userSummarySheet = XLSX.utils.json_to_sheet(userSummaryData);
    XLSX.utils.book_append_sheet(workbook, userSummarySheet, "User Summary");

    // Add Market Summary sheet
    const marketSummarySheet = XLSX.utils.json_to_sheet(marketSummaryData);
    XLSX.utils.book_append_sheet(
      workbook,
      marketSummarySheet,
      "Market Summary"
    );

    // Add Statistics sheet
    const statsSheet = XLSX.utils.json_to_sheet(overallStats);
    XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistics");

    // Set column widths for better readability
    const transactionSheetRef = workbook.Sheets["All Transactions"];
    transactionSheetRef["!cols"] = [
      { wch: 25 }, // Transaction ID
      { wch: 25 }, // User Email
      { wch: 40 }, // Market Title
      { wch: 12 }, // Market Status
      { wch: 8 }, // Type
      { wch: 12 }, // Shares/Amount
      { wch: 10 }, // Price
      { wch: 12 }, // Points Change
      { wch: 8 }, // Source
      { wch: 30 }, // Notes
      { wch: 20 }, // Email Message ID
      { wch: 12 }, // Transaction Date
      { wch: 10 }, // Transaction Time
      { wch: 20 }, // Full Timestamp
    ];

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions_export_${timestamp}.xlsx`
    );

    console.log(
      `📊 Transaction export completed: ${transactions.length} transactions`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export transactions error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Export comprehensive market data as Excel
exports.exportMarkets = async (req, res) => {
  try {
    console.log("📊 Starting market data export...");

    // Get all markets with related data
    const markets = await Market.find({});
    const transactions = await Transaction.find({})
      .populate("user", "email")
      .populate("market", "title");
    const positions = await Position.find({})
      .populate("user", "email")
      .populate("market", "title");

    // Create market summary data
    const marketData = markets.map((market) => {
      const marketTransactions = transactions.filter(
        (tx) => tx.market._id.toString() === market._id.toString()
      );
      const marketPositions = positions.filter(
        (pos) => pos.market._id.toString() === market._id.toString()
      );

      return {
        "Market ID": market._id.toString(),
        Title: market.title,
        Description: market.description || "",
        Status: market.status,
        "Current Probability (%)": market.currentProbability,
        "YES Volume": market.yesVolume || 0,
        "NO Volume": market.noVolume || 0,
        "Total Volume": market.totalVolume || 0,
        "Participant Count": market.participantCount || 0,
        "Fixed YES Price": market.fixedYesPrice,
        "Fixed NO Price": market.fixedNoPrice,
        "Transaction Count": marketTransactions.length,
        "Position Count": marketPositions.length,
        "Created Date": market.createdAt.toISOString().split("T")[0],
        Deadline: market.deadline.toISOString().split("T")[0],
        "Resolution Outcome":
          market.resolution?.outcome !== undefined
            ? market.resolution.outcome
              ? "YES"
              : "NO"
            : "",
        "Resolution Date": market.resolution?.resolvedAt
          ? market.resolution.resolvedAt.toISOString().split("T")[0]
          : "",
        "Resolution Notes": market.resolution?.notes || "",
        Tags: market.tags?.join(", ") || "",
      };
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Add Markets sheet
    const marketSheet = XLSX.utils.json_to_sheet(marketData);
    XLSX.utils.book_append_sheet(workbook, marketSheet, "Markets");

    // Set column widths
    const marketSheetRef = workbook.Sheets["Markets"];
    marketSheetRef["!cols"] = [
      { wch: 25 }, // Market ID
      { wch: 50 }, // Title
      { wch: 50 }, // Description
      { wch: 10 }, // Status
      { wch: 15 }, // Current Probability
      { wch: 12 }, // YES Volume
      { wch: 12 }, // NO Volume
      { wch: 12 }, // Total Volume
      { wch: 15 }, // Participant Count
      { wch: 15 }, // Fixed YES Price
      { wch: 15 }, // Fixed NO Price
      { wch: 15 }, // Transaction Count
      { wch: 15 }, // Position Count
      { wch: 12 }, // Created Date
      { wch: 12 }, // Deadline
      { wch: 15 }, // Resolution Outcome
      { wch: 15 }, // Resolution Date
      { wch: 30 }, // Resolution Notes
      { wch: 20 }, // Tags
    ];

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=markets_export_${timestamp}.xlsx`
    );

    console.log(`📊 Market export completed: ${markets.length} markets`);
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export markets error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create admin user (for initial setup)
exports.createAdmin = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: "admin" });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin user already exists" });
    }

    const admin = new User({
      email,
      name,
      password,
      role: "admin",
      emailVerified: true,
    });

    await admin.save();

    res.status(201).json({
      message: "Admin user created successfully",
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
