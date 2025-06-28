const cron = require("node-cron");
const MarketService = require("../services/marketService");
const emailController = require("../controllers/emailController");
class CronJobs {
  static start() {
    console.log("🕐 Starting cron jobs...");

    // Check for expired markets every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        console.log("🔍 Checking for expired markets...");
        const closedCount = await MarketService.closeExpiredMarkets();
        if (closedCount > 0) {
          console.log(`⏰ Closed ${closedCount} expired markets`);
        }
      } catch (error) {
        console.error("❌ Error in expired markets cron job:", error);
      }
    });

    // Execute scheduled email cycles every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        console.log("📧 Checking for scheduled email cycles...");
        const result = await emailController.executeScheduledCycles();
        if (result.executed > 0) {
          console.log(`📧 Executed ${result.executed} email cycles`);
        }
      } catch (error) {
        console.error("❌ Error in scheduled email cron job:", error);
      }
    });

    // Daily cleanup of old email cycles (optional)
    cron.schedule("0 2 * * *", async () => {
      try {
        console.log("🧹 Cleaning up old email cycles...");
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await EmailCycle.deleteMany({
          status: { $in: ["completed", "failed"] },
          createdAt: { $lt: thirtyDaysAgo },
        });

        if (result.deletedCount > 0) {
          console.log(`🧹 Cleaned up ${result.deletedCount} old email cycles`);
        }
      } catch (error) {
        console.error("❌ Error in email cleanup cron job:", error);
      }
    });

    console.log("✅ Cron jobs started successfully");
  }

  static stop() {
    cron.destroy();
    console.log("🛑 Cron jobs stopped");
  }
}

module.exports = CronJobs;
