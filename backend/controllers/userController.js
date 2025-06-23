const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { validationResult } = require("express-validator");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const users = await User.find()
      .select("-password") // No need to exclude verificationToken
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((page - 1) * limit);

    const total = await User.countDocuments();

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, points, isActive, preferences } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (points !== undefined) user.points = points;
    if (isActive !== undefined) user.isActive = isActive;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        points: user.points,
        isActive: user.isActive,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const transactionCount = await Transaction.countDocuments({
      user: user._id,
    });
    if (transactionCount > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete user with existing transactions" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Bulk update users
exports.bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, action, value } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    let updateData = {};

    switch (action) {
      case "reset-points":
        updateData = { points: 1000 };
        break;
      case "add-points":
        if (!value || isNaN(value)) {
          return res
            .status(400)
            .json({ message: "Valid points value required" });
        }
        await User.updateMany(
          { _id: { $in: userIds } },
          { $inc: { points: Number(value) } }
        );
        return res.json({
          message: `Added ${value} points to ${userIds.length} users`,
        });
      case "deactivate":
        updateData = { isActive: false };
        break;
      case "activate":
        updateData = { isActive: true };
        break;
      default:
        return res.status(400).json({ message: "Invalid action" });
    }

    const result = await User.updateMany({ _id: { $in: userIds } }, updateData);

    res.json({
      message: `Updated ${result.modifiedCount} users`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// User stats
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      totalUsers,
      activeUsers,
      recentUsers,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
