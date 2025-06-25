const cron = require("node-cron");
const EmailCycle = require("./models/EmailCycle");
const User = require("./models/User");
const Market = require("./models/Market");
const emailService = require("./services/emailService");
const { getNextRunDate } = require("./utils/scheduleUtils");

cron.schedule("* * * * *", async () => {
  const now = new Date();

  const dueCycles = await EmailCycle.find({
    status: "scheduled",
    "recurrence.nextRun": { $lte: now },
  });

  for (const cycle of dueCycles) {
    try {
      const markets = await Market.find({ status: "active" });
      const users = await User.find({
        isActive: true,
        "preferences.emailNotifications": true,
        "preferences.marketUpdates": true,
      });

      const emailCycle = await emailService.sendMarketCycleEmail(
        markets,
        users
      );

      // Update nextRun for future execution
      cycle.recurrence.nextRun = getNextRunDate(cycle.recurrence);
      cycle.stats = emailCycle.stats;
      cycle.recipients = emailCycle.recipients;
      await cycle.save();

      console.log(`Executed email cycle: ${cycle.title}`);
    } catch (error) {
      console.error(`Failed to run cycle "${cycle.title}":`, error);
      cycle.status = "failed";
      await cycle.save();
    }
  }
});
