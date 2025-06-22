const User = require("../models/User")
const Market = require("../models/Market")
const Transaction = require("../models/Transaction")
const EmailCycle = require("../models/EmailCycle")

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments({ role: "participant" })
    const activeUsers = await User.countDocuments({ role: "participant", isActive: true })
    const verifiedUsers = await User.countDocuments({ role: "participant", emailVerified: true })

    // Market statistics
    const totalMarkets = await Market.countDocuments()
    const activeMarkets = await Market.countDocuments({ status: "active" })
    const resolvedMarkets = await Market.countDocuments({ status: "resolved" })

    // Transaction statistics
    const totalTransactions = await Transaction.countDocuments()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayTransactions = await Transaction.countDocuments({
      createdAt: { $gte: todayStart },
    })

    // Email statistics
    const totalEmailCycles = await EmailCycle.countDocuments()
    const lastEmailCycle = await EmailCycle.findOne().sort({ createdAt: -1 })

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentUsers = await User.countDocuments({
      role: "participant",
      createdAt: { $gte: sevenDaysAgo },
    })

    const recentTransactions = await Transaction.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    })

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
    })
  } catch (error) {
    console.error("Get dashboard stats error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Export user data as CSV
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "participant" }).select("-password -verificationToken")

    // Create CSV content
    const csvHeader = ["Email", "Name", "Points", "Accuracy", "Total Predictions", "Join Date", "Last Active", "Status"]

    const csvRows = users.map((user) => [
      user.email,
      user.name,
      user.points,
      `${user.stats.accuracy}%`,
      user.stats.totalPredictions,
      user.createdAt.toISOString().split("T")[0],
      user.lastActive.toISOString().split("T")[0],
      user.isActive ? "Active" : "Inactive",
    ])

    const csvContent = [csvHeader, ...csvRows].map((row) => row.join(",")).join("\n")

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", "attachment; filename=users.csv")
    res.send(csvContent)
  } catch (error) {
    console.error("Export users error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Export transaction data as CSV
exports.exportTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("user", "name email")
      .populate("market", "title")
      .sort({ createdAt: -1 })

    // Create CSV content
    const csvHeader = ["User", "Email", "Market", "Type", "Amount", "Price", "Points Change", "Date", "Source"]

    const csvRows = transactions.map((tx) => [
      tx.user.name,
      tx.user.email,
      tx.market.title,
      tx.type,
      tx.amount,
      `${tx.price}%`,
      tx.pointsChange,
      tx.createdAt.toISOString().split("T")[0],
      tx.source,
    ])

    const csvContent = [csvHeader, ...csvRows].map((row) => row.join(",")).join("\n")

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", "attachment; filename=transactions.csv")
    res.send(csvContent)
  } catch (error) {
    console.error("Export transactions error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Create admin user (for initial setup)
exports.createAdmin = async (req, res) => {
  try {
    const { email, name, password } = req.body

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: "admin" })
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin user already exists" })
    }

    const admin = new User({
      email,
      name,
      password,
      role: "admin",
      emailVerified: true,
    })

    await admin.save()

    res.status(201).json({
      message: "Admin user created successfully",
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    })
  } catch (error) {
    console.error("Create admin error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
