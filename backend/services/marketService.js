const Market = require("../models/Market");
const Position = require("../models/Position");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const emailService = require("./emailService");

class MarketService {
  /**
   * Check and close expired markets
   * This should be run periodically (e.g., via cron job)
   */
  async closeExpiredMarkets() {
    try {
      const now = new Date();

      // Find all active markets that have passed their deadline
      const expiredMarkets = await Market.find({
        status: "active",
        deadline: { $lt: now },
      });

      console.log(`Found ${expiredMarkets.length} expired markets to close`);

      for (const market of expiredMarkets) {
        await this.closeMarket(market._id);
      }

      return expiredMarkets.length;
    } catch (error) {
      console.error("Error closing expired markets:", error);
      throw error;
    }
  }

  /**
   * Close a specific market (change status from active to closed)
   */
  async closeMarket(marketId) {
    try {
      const market = await Market.findById(marketId);
      if (!market) {
        throw new Error("Market not found");
      }

      if (market.status !== "active") {
        console.log(`Market ${market.title} is already ${market.status}`);
        return market;
      }

      // Change status to closed
      market.status = "closed";
      await market.save();

      console.log(`✅ Market closed: ${market.title}`);

      // Get all users with positions in this market
      const positions = await Position.find({ market: marketId }).populate(
        "user"
      );
      const usersWithPositions = positions.map((p) => p.user);

      // Send notification emails to participants
      if (usersWithPositions.length > 0) {
        await this.sendMarketClosedNotifications(market, usersWithPositions);
      }

      return market;
    } catch (error) {
      console.error(`Error closing market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve a market with the final outcome
   */
  async resolveMarket(marketId, outcome, notes = "") {
    try {
      const market = await Market.findById(marketId);
      if (!market) {
        throw new Error("Market not found");
      }

      if (market.status === "resolved") {
        throw new Error("Market already resolved");
      }

      // Set market as resolved
      market.status = "resolved";
      market.resolution = {
        outcome: outcome === "true" || outcome === true || outcome === "YES",
        resolvedAt: new Date(),
        notes: notes,
      };

      await market.save();

      console.log(
        `✅ Market resolved: ${market.title} - Outcome: ${
          market.resolution.outcome ? "YES" : "NO"
        }`
      );

      // Calculate and distribute payouts
      await this.distributePayouts(market);

      return market;
    } catch (error) {
      console.error(`Error resolving market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Distribute payouts to winning positions
   */
  async distributePayouts(market) {
    try {
      const positions = await Position.find({ market: market._id }).populate(
        "user"
      );
      let totalPayout = 0;
      let winnersCount = 0;

      console.log(`💰 Distributing payouts for market: ${market.title}`);

      for (const position of positions) {
        let payout = 0;

        if (market.resolution.outcome) {
          // YES outcome - YES shares pay out 100 points each
          payout = position.sharesYes * 100;
        } else {
          // NO outcome - NO shares pay out 100 points each
          payout = position.sharesNo * 100;
        }

        if (payout > 0) {
          // Add payout to user's points
          position.user.points += payout;
          position.realizedPnL += payout;

          await position.user.save();
          await position.save();

          totalPayout += payout;
          winnersCount++;

          console.log(`💰 Paid ${payout} points to ${position.user.email}`);
        }
      }

      console.log(
        `✅ Total payout: ${totalPayout} points to ${winnersCount} winners`
      );

      // Send payout notification emails
      if (winnersCount > 0) {
        await this.sendPayoutNotifications(market, positions);
      }

      return { totalPayout, winnersCount };
    } catch (error) {
      console.error(
        `Error distributing payouts for market ${market._id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send notifications when market closes (deadline reached)
   */
  async sendMarketClosedNotifications(market, users) {
    try {
      console.log(
        `📧 Sending market closed notifications for: ${market.title}`
      );

      for (const user of users) {
        if (!user.preferences.emailNotifications) continue;

        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: `⏰ Market Closed: ${market.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>⏰ Market Deadline Reached</h2>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3>${market.title}</h3>
                <p><strong>Status:</strong> Closed for trading</p>
                <p><strong>Deadline:</strong> ${new Date(
                  market.deadline
                ).toLocaleString()}</p>
              </div>

              <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h4>What happens next?</h4>
                <ul>
                  <li>🔒 No more trading allowed</li>
                  <li>⏳ Waiting for official resolution</li>
                  <li>💰 Payouts will be distributed once resolved</li>
                  <li>📧 You'll receive notification when resolved</li>
                </ul>
              </div>

              <p>Your shares are safe and will pay out 100 points each if you picked the correct outcome!</p>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is part of an academic psychology research study.
              </p>
            </div>
          `,
          text: `
Market Deadline Reached

${market.title}
Status: Closed for trading
Deadline: ${new Date(market.deadline).toLocaleString()}

What happens next?
- No more trading allowed
- Waiting for official resolution  
- Payouts will be distributed once resolved
- You'll receive notification when resolved

Your shares are safe and will pay out 100 points each if you picked the correct outcome!
          `,
        };

        await emailService.transporter.sendMail(mailOptions);
      }

      console.log(
        `✅ Market closed notifications sent to ${users.length} users`
      );
    } catch (error) {
      console.error("Error sending market closed notifications:", error);
    }
  }

  /**
   * Send payout notifications when market is resolved
   */
  async sendPayoutNotifications(market, positions) {
    try {
      console.log(`📧 Sending payout notifications for: ${market.title}`);

      for (const position of positions) {
        const user = position.user;
        if (!user.preferences.emailNotifications) continue;

        let payout = 0;
        let winningShares = 0;
        let losingShares = 0;
        let outcome = "";

        if (market.resolution.outcome) {
          // YES won
          payout = position.sharesYes * 100;
          winningShares = position.sharesYes;
          losingShares = position.sharesNo;
          outcome = "YES";
        } else {
          // NO won
          payout = position.sharesNo * 100;
          winningShares = position.sharesNo;
          losingShares = position.sharesYes;
          outcome = "NO";
        }

        const subject =
          payout > 0
            ? `🎉 You Won! Market Resolved: ${market.title}`
            : `📊 Market Resolved: ${market.title}`;

        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${
                payout > 0 ? "🎉 Congratulations!" : "📊 Market Resolved"
              }</h2>
              
              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>${market.title}</h3>
                <p><strong>Final Outcome:</strong> ${outcome}</p>
                <p><strong>Resolved:</strong> ${new Date(
                  market.resolution.resolvedAt
                ).toLocaleString()}</p>
                ${
                  market.resolution.notes
                    ? `<p><strong>Notes:</strong> ${market.resolution.notes}</p>`
                    : ""
                }
              </div>

              ${
                payout > 0
                  ? `
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h4>💰 Your Payout</h4>
                  <p><strong>Winning Shares:</strong> ${winningShares} × 100 points = ${payout} points</p>
                  <p><strong>Added to Balance:</strong> +${payout} points</p>
                  <p><strong>New Balance:</strong> ${user.points} points</p>
                </div>
              `
                  : `
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                  <h4>📊 Your Position</h4>
                  <p>Unfortunately, your ${
                    losingShares > 0 ? `${losingShares} shares` : "position"
                  } didn't win this time.</p>
                  <p>Better luck on the next market!</p>
                </div>
              `
              }

              <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h4>📈 Position Summary</h4>
                <p><strong>YES Shares:</strong> ${position.sharesYes}</p>
                <p><strong>NO Shares:</strong> ${position.sharesNo}</p>
                <p><strong>Total Invested:</strong> ${
                  position.totalInvested
                } points</p>
                <p><strong>Total Realized P&L:</strong> ${
                  position.realizedPnL
                } points</p>
              </div>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is part of an academic psychology research study.
              </p>
            </div>
          `,
          text: `
${payout > 0 ? "Congratulations! You Won!" : "Market Resolved"}

${market.title}
Final Outcome: ${outcome}
Resolved: ${new Date(market.resolution.resolvedAt).toLocaleString()}
${market.resolution.notes ? `Notes: ${market.resolution.notes}` : ""}

${
  payout > 0
    ? `
Your Payout:
Winning Shares: ${winningShares} × 100 points = ${payout} points
Added to Balance: +${payout} points
New Balance: ${user.points} points
`
    : `
Your Position:
Unfortunately, your position didn't win this time.
Better luck on the next market!
`
}

Position Summary:
YES Shares: ${position.sharesYes}
NO Shares: ${position.sharesNo}
Total Invested: ${position.totalInvested} points
Total Realized P&L: ${position.realizedPnL} points
          `,
        };

        await emailService.transporter.sendMail(mailOptions);
      }

      console.log(`✅ Payout notifications sent`);
    } catch (error) {
      console.error("Error sending payout notifications:", error);
    }
  }

  /**
   * Get market statistics including time remaining
   */
  getMarketTimeStatus(market) {
    const now = new Date();
    const deadline = new Date(market.deadline);
    const timeRemaining = deadline - now;

    if (timeRemaining <= 0) {
      return {
        status: market.status === "active" ? "expired" : market.status,
        timeRemaining: 0,
        timeRemainingText: "Deadline passed",
      };
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
    );

    let timeRemainingText = "";
    if (days > 0) {
      timeRemainingText = `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      timeRemainingText = `${hours}h ${minutes}m remaining`;
    } else {
      timeRemainingText = `${minutes}m remaining`;
    }

    return {
      status: market.status,
      timeRemaining,
      timeRemainingText,
    };
  }
}

module.exports = new MarketService();
