const EmailCycle = require("../models/EmailCycle");
const User = require("../models/User");
const Market = require("../models/Market");
const emailService = require("../services/emailService");
const { validationResult } = require("express-validator");
const { getNextRunDate } = require("../utils/scheduleUtils");
const { getRecurrenceDescription } = require("../utils/scheduleUtils");
// Execute scheduled email cycles (called by cron jobs)
exports.executeScheduledCycles = async (req, res) => {
  try {
    const now = new Date();

    // Find all scheduled cycles that are due to run
    const dueCycles = await EmailCycle.find({
      status: "scheduled",
      "recurrence.nextRun": { $lte: now },
    }).populate("markets");

    console.log(`📅 Found ${dueCycles.length} email cycles due for execution`);

    let executed = 0;
    let failed = 0;

    for (const cycle of dueCycles) {
      try {
        await this.sendMarketCycle(cycle);
        executed++;
      } catch (error) {
        console.error(`❌ Failed to execute cycle ${cycle._id}:`, error);
        failed++;

        // Mark cycle as failed
        cycle.status = "failed";
        cycle.lastError = error.message;
        await cycle.save();
      }
    }

    const result = {
      message: `Executed ${executed} email cycles, ${failed} failed`,
      executed,
      failed,
      totalDue: dueCycles.length,
    };

    if (res) {
      res.json(result);
    }

    return result;
  } catch (error) {
    console.error("❌ Error executing scheduled cycles:", error);
    if (res) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
    throw error;
  }
};

// Create automatic daily email schedule
exports.scheduleEmailCycle = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      recurrence,
      // createdBy, // optionally passed or get from req.user
    } = req.body;

    // Validate recurrence object
    const { frequency, timeOfDay, dayOfWeek, dayOfMonth } = recurrence;

    // Get all active markets
    const validMarkets = await Market.find({ status: "active" }).select(
      "_id title"
    );

    if (validMarkets.length === 0) {
      return res.status(400).json({
        message: "No active markets found to schedule emails for",
      });
    }

    // Parse time
    const [hour, minute] = timeOfDay.split(":").map(Number);

    // Build recurrence config based on frequency
    const recurrenceConfig = {
      type: frequency,
      hour,
      minute,
      timezone: recurrence.timezone || "UTC",
      enabled: true,
      executionCount: 0,
    };

    // Add frequency-specific fields
    switch (frequency) {
      case "daily":
        // No additional fields needed for daily
        break;

      case "weekly":
        if (dayOfWeek === undefined) {
          return res.status(400).json({
            message: "dayOfWeek is required for weekly frequency",
          });
        }
        recurrenceConfig.dayOfWeek = dayOfWeek;
        break;

      case "monthly":
        if (dayOfMonth === undefined) {
          return res.status(400).json({
            message: "dayOfMonth is required for monthly frequency",
          });
        }
        recurrenceConfig.dayOfMonth = dayOfMonth;
        break;

      default:
        return res.status(400).json({
          message: "Invalid frequency. Must be daily, weekly, or monthly",
        });
    }

    // Calculate next run date
    const nextRun = getNextRunDate(recurrenceConfig);

    // // Validate markets exist and are active
    // const validMarkets = await Market.find({
    //   _id: { $in: markets },
    //   status: "active",
    // }).select("_id title");

    // if (validMarkets.length === 0) {
    //   return res.status(400).json({
    //     message: "No valid active markets found",
    //   });
    // }

    // if (validMarkets.length !== markets.length) {
    //   console.warn(
    //     `⚠️ Some markets were invalid or inactive. Using ${validMarkets.length} of ${markets.length} markets.`
    //   );
    // }

    // Create the scheduled email cycle
    const newCycle = await EmailCycle.create({
      title:
        title ||
        `${
          frequency.charAt(0).toUpperCase() + frequency.slice(1)
        } Market Update - ${timeOfDay}`,
      markets: validMarkets.map((m) => m._id),
      recurrence: {
        ...recurrenceConfig,
        nextRun,
      },
      status: "scheduled",
      // createdBy: createdBy || req.user?.id || "system",
    });

    // Generate human-readable description
    const description = getRecurrenceDescription(recurrenceConfig);

    res.status(201).json({
      message: "Email cycle scheduled successfully",
      cycle: {
        id: newCycle._id,
        title: newCycle.title,
        frequency,
        description,
        nextRun: nextRun.toISOString(),
        marketsCount: validMarkets.length,
        markets: validMarkets.map((m) => ({ id: m._id, title: m.title })),
      },
    });
  } catch (error) {
    console.error("Error scheduling email cycle:", error);
    res.status(500).json({
      error: "Failed to schedule email cycle",
      message: error.message,
    });
  }
};

// Send market cycle email
exports.sendMarketCycle = async (req, res) => {
  try {
    // Get all active markets
    const markets = await Market.find({ status: "active" }).sort({
      createdAt: -1,
    });

    if (markets.length === 0) {
      return res.status(400).json({ message: "No active markets found" });
    }

    // Get all active users who want email notifications
    const users = await User.find({
      isActive: true,
      "preferences.emailNotifications": true,
      "preferences.marketUpdates": true,
    });

    if (users.length === 0) {
      return res
        .status(400)
        .json({ message: "No users found for email notifications" });
    }

    // Send emails
    const emailCycle = await emailService.sendMarketCycleEmail(markets, users);

    res.json({
      message: "Market cycle emails sent successfully",
      emailCycle: {
        id: emailCycle._id,
        totalRecipients: emailCycle.stats.totalRecipients,
        sent: emailCycle.stats.sent,
        failed: emailCycle.stats.failed,
      },
    });
  } catch (error) {
    console.error("Send market cycle error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get email cycles history
exports.getEmailCycles = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const emailCycles = await EmailCycle.find()
      .populate("markets", "title")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await EmailCycle.countDocuments();

    res.json({
      emailCycles,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get email cycles error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single email cycle
exports.getEmailCycle = async (req, res) => {
  try {
    const emailCycle = await EmailCycle.findById(req.params.id)
      .populate("markets", "title")
      .populate("recipients.user", "email");

    if (!emailCycle) {
      return res.status(404).json({ message: "Email cycle not found" });
    }

    res.json(emailCycle);
  } catch (error) {
    console.error("Get email cycle error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Send custom email to users
exports.sendCustomEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userIds, subject, htmlContent, textContent } = req.body;

    // Get users
    const users = await User.find({ _id: { $in: userIds } });

    if (users.length === 0) {
      return res.status(400).json({ message: "No users found" });
    }

    // Create email cycle
    const emailCycle = new EmailCycle({
      title: subject,
      template: { subject, htmlContent, textContent },
      status: "sending",
      stats: { totalRecipients: users.length },
    });

    await emailCycle.save();

    // Send emails
    for (const user of users) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject,
          html: htmlContent
            // .replace("{{USER_NAME}}", user.name)
            .replace("{{USER_POINTS}}", user.points),
          text: textContent
            // .replace("{{USER_NAME}}", user.name)
            .replace("{{USER_POINTS}}", user.points),
        };

        await emailService.transporter.sendMail(mailOptions);

        emailCycle.recipients.push({
          user: user._id,
          email: user.email,
          status: "sent",
          sentAt: new Date(),
        });
        emailCycle.stats.sent += 1;
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);

        emailCycle.recipients.push({
          user: user._id,
          email: user.email,
          status: "failed",
          error: error.message,
        });
        emailCycle.stats.failed += 1;
      }
    }

    emailCycle.status = "completed";
    await emailCycle.save();

    res.json({
      message: "Custom emails sent",
      emailCycle: {
        id: emailCycle._id,
        sent: emailCycle.stats.sent,
        failed: emailCycle.stats.failed,
      },
    });
  } catch (error) {
    console.error("Send custom email error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
