const cron = require("node-cron");
const MarketService = require("../services/marketService");

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

    console.log("✅ Cron jobs started successfully");
  }

  static stop() {
    cron.destroy();
    console.log("🛑 Cron jobs stopped");
  }
}

module.exports = CronJobs;
