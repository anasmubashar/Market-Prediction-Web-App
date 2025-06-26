// services/emailCycleRunner.js

const mongoose = require("mongoose");
const EmailCycle = require("../models/EmailCycle");
const Market = require("../models/Market");
const User = require("../models/User");
const emailService = require("./emailService");
const { getNextRunDate } = require("../utils/scheduleUtils");

async function runScheduledEmailCycles() {
  const now = new Date();

  // 1. Find all scheduled cycles due to run
  const dueCycles = await EmailCycle.find({
    status: "scheduled",
    "recurrence.nextRun": { $lte: now },
  });

  for (const cycle of dueCycles) {
    try {
      // 2. Load the markets for this cycle (only active ones)
      const markets = await Market.find({
        _id: { $in: cycle.markets },
        status: "active",
      });

      // 3. Load all users who want market-update emails
      const users = await User.find({
        isActive: true,
        "preferences.emailNotifications": true,
        "preferences.marketUpdates": true,
      });

      // 4. Send the cycle email
      const emailResult = await emailService.sendMarketCycleEmail(
        markets,
        users
      );

      // 5a. Update nextRun + stats + recipients
      cycle.recurrence.nextRun = getNextRunDate(cycle.recurrence);
      cycle.stats = emailResult.stats;
      cycle.recipients = emailResult.recipients;
      await cycle.save();

      console.log(`✅ Executed email cycle: ${cycle.title}`);
    } catch (error) {
      // 5b. On error, mark cycle as failed
      console.error(`❌ Failed cycle "${cycle.title}":`, error);
      cycle.status = "failed";
      await cycle.save();
    }
  }
}

module.exports = runScheduledEmailCycles;
