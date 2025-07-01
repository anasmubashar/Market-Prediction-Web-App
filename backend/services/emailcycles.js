const nodemailer = require("nodemailer");
const User = require("../models/User");
const Market = require("../models/Market");
const EmailCycle = require("../models/EmailCycle");
const ChartService = require("./chartService");
const FixedMarketService = require("./fixedMarketService");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Send welcome email (no verification needed)
  async sendWelcomeEmail(user) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "Welcome to TUSQ",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to TUSQ!</h2>
            <p>Thank you for joining.</p>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>🎉 Starting Balance: 1000 Points</h3>
              <p>You've been credited with 1000 points to start participating in prediction markets.</p>
            </div>

            <h3>How to Participate:</h3>
            <ul>
              <li>Reply to market emails with simple commands</li>
              <li>Use "BUY [amount]" to spend points on shares</li>
              <li>Example: "BUY 50 YES" or "BUY 100 NO"</li>
            </ul>

            <p>You'll receive your first prediction market email soon!</p>
            
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is part of an academic psychology research study. 
              You can unsubscribe at any time by replying with "UNSUBSCRIBE".
            </p>
          </div>
        `,
        text: `
          Welcome to Prediction Market!
          
          Starting balance: 1000 points
          
          How to participate:
          - Reply to emails with BUY [amount] to spend points on shares
          - Example: BUY 50 YES or BUY 100 NO
          
          You'll receive your first market email soon!
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw error;
    }
  }

  // Send market cycle email to all active users
  async sendMarketCycleEmail(markets, users) {
    try {
      const emailCycle = new EmailCycle({
        title: `Market Update - ${new Date().toLocaleDateString()}`,
        markets: markets.map((m) => m._id),
        status: "sending",
      });

      // Generate email content
      const { subject, htmlContent, textContent, attachments } =
        await this.generateMarketEmailContent(markets);

      emailCycle.template = { subject, htmlContent, textContent };
      emailCycle.stats.totalRecipients = users.length;

      await emailCycle.save();

      // Send emails to all users
      for (const user of users) {
        try {
          await this.sendMarketEmailToUser(
            user,
            markets,
            subject,
            htmlContent,
            textContent,
            attachments
          );

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

      return emailCycle;
    } catch (error) {
      console.error("Error sending market cycle email:", error);
      throw error;
    }
  }

  // Send market email to individual user
  async sendMarketEmailToUser(
    user,
    markets,
    subject,
    htmlContent,
    textContent,
    attachments = []
  ) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject,
      html: htmlContent.replace("{{USER_POINTS}}", user.points),
      text: textContent.replace("{{USER_POINTS}}", user.points),
      attachments,
      headers: {
        "Reply-To": process.env.EMAIL_USER,
        "Message-ID": `<${Date.now()}-${user._id}@predictionmarket.com>`,
      },
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Generate market email content with simple volume line charts
  async generateMarketEmailContent(markets) {
    const subject = `Prediction Markets Update - ${markets.length} Active Markets`;
    const attachments = [];

    // Generate volume line charts for each market
    const marketListHtml = await Promise.all(
      markets.map(async (market) => {
        const chartBuffer = await ChartService.generateProbabilityChartBuffer(
          market,
          market._id.toString()
        );
        const cid = `chart${market._id}@tusq`;

        attachments.push({
          filename: `volume-chart-${market._id}.png`,
          content: chartBuffer,
          cid,
          contentType: "image/png",
        });

        const volumeStats = FixedMarketService.getVolumeStats(market);

        return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937;">${market.title}</h3>

        <div style="display: flex; align-items: center; width: 100%; margin-bottom: 16px;">
          <div style="min-width: 120px; margin-right: 16px;">
            <span style="font-size: 24px; font-weight: bold; color: #4f46e5;">
              ${volumeStats.yesPercentage}%
            </span>
            <span style="color: #6b7280; margin-left: 4px;">YES volume</span>
          </div>
          
          <div style="text-align: right; color: #6b7280; font-size: 14px; margin-left: auto;">
            <div>YES: ${volumeStats.yesVolume} points (${
          volumeStats.yesPercentage
        }%)</div>
            <div>NO: ${volumeStats.noVolume} points (${
          volumeStats.noPercentage
        }%)</div>
            <div>Total Volume: ${volumeStats.totalVolume} points</div>
            <div>Deadline: ${new Date(
              market.deadline
            ).toLocaleDateString()}</div>
          </div>
        </div>

        <img src="cid:${cid}" style="max-width: 100%; margin-top: 10px; border-radius: 6px;" />

        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Reply with: <strong>BUY [amount] YES</strong> or <strong>BUY [amount] NO</strong>
          </p>
          ${
            volumeStats.totalVolume > 0
              ? `<p style="margin: 4px 0 0 0; color: #059669; font-size: 12px;">
                   📊 Market sentiment: ${
                     volumeStats.yesPercentage > volumeStats.noPercentage
                       ? `${volumeStats.yesPercentage}% leaning YES`
                       : volumeStats.noPercentage > volumeStats.yesPercentage
                       ? `${volumeStats.noPercentage}% leaning NO`
                       : "Evenly split"
                   }
                 </p>`
              : `<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">
                   📊 No trading activity yet - be the first to trade!
                 </p>`
          }
        </div>
      </div>
        `;
      })
    );

    const marketListText = markets.map((market) => {
      const volumeStats = FixedMarketService.getVolumeStats(market);
      return `
Market: ${market.title}
YES Volume: ${volumeStats.yesPercentage}% (${volumeStats.yesVolume} points)
NO Volume: ${volumeStats.noPercentage}% (${volumeStats.noVolume} points)
Total Volume: ${volumeStats.totalVolume} points
Deadline: ${new Date(market.deadline).toLocaleDateString()}
      `;
    });

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello! </h2>
      <p>Here are the current prediction markets with volume-based charts:</p>
      
      <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0;">💰 Your Current Balance: {{USER_POINTS}} points</h3>
      </div>

      ${marketListHtml.join("")}

      <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">📊 Volume Charts Show Real User Sentiment</h3>
        <p>The line chart shows the percentage of investment going to YES over time. This reflects what users actually think, not just the fixed odds.</p>
        
        <h4 style="margin: 16px 0 8px 0;">💡 How to Trade</h4>
        <ul style="list-style-type: none; padding-left: 0;">
          <li><strong>BUY 50 YES</strong> – Spend 50 points on YES shares</li>
          <li><strong>BUY 50 NO</strong> – Spend 50 points on NO shares</li>
          <li><strong>BUY 100</strong> – Spend 100 points (defaults to YES)</li>
        </ul>

        <p style="color: #065f46; margin: 12px 0;">✅ Each share pays out <strong>100 points</strong> if you're right</p>
      </div>
    </div>
    `;

    const textContent = `
Hello!

Your Current Balance: {{USER_POINTS}} points

Current Prediction Markets with Volume Analysis:
${marketListText.join("\n")}

Volume Charts Show Real User Sentiment:
The charts show the percentage of investment going to YES over time.

How to Trade:
- BUY [amount] YES or BUY [amount] NO
- Each share pays 100 points if you're right

Academic Psychology Research Study
Reply "UNSUBSCRIBE" to opt out
    `;

    return { subject, htmlContent, textContent, attachments };
  }

  // Send transaction confirmation email
  async sendTransactionConfirmation(
    user,
    transaction,
    market,
    marketSelectionMethod = "unknown",
    marketSelectionDetails = ""
  ) {
    try {
      const pointsText =
        transaction.pointsChange > 0
          ? `+${transaction.pointsChange}`
          : transaction.pointsChange;

      // Market selection explanation
      let selectionExplanation = "";
      let selectionColor = "#666";

      switch (marketSelectionMethod) {
        case "exact_title_match":
          selectionExplanation = "✅ Exact market title match";
          selectionColor = "#28a745";
          break;
        case "partial_title_match":
          selectionExplanation = "✅ Partial market title match";
          selectionColor = "#28a745";
          break;
        case "keyword_match":
          selectionExplanation = "✅ Keyword match found";
          selectionColor = "#28a745";
          break;
        case "single_active_market":
          selectionExplanation = "ℹ️ Only one active market available";
          selectionColor = "#17a2b8";
          break;
        case "last_email_cycle":
          selectionExplanation = "📧 Selected from your last email update";
          selectionColor = "#17a2b8";
          break;
        case "most_recent_fallback":
          selectionExplanation = "⚠️ Used most recent market (no hint match)";
          selectionColor = "#ffc107";
          break;
        default:
          selectionExplanation = "🎯 Market automatically selected";
          selectionColor = "#666";
      }

      const side = transaction.notes.includes("YES") ? "YES" : "NO";
      const maxPayout = transaction.amount * 100; // Each share pays 100 points
      const potentialProfit = maxPayout + transaction.pointsChange; // pointsChange is negative for purchases

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: `✅ Purchase Confirmed: ${transaction.amount} ${side} shares in ${market.title}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>✅ Purchase Confirmed!</h2>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>You bought ${transaction.amount} ${side} shares</h3>
            <p><strong>Market:</strong> ${market.title}</p>
            <p><strong>Cost:</strong> ${Math.abs(
              transaction.pointsChange
            )} points</p>
            <p><strong>Max Payout:</strong> ${maxPayout} points (if ${side} wins)</p>
            <p><strong>Potential Profit:</strong> ${potentialProfit} points</p>
            <p><strong>New Balance:</strong> ${user.points} points</p>
          </div>

          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${selectionColor};">
            <p style="margin: 0; font-size: 14px; color: ${selectionColor};">
              <strong>Market Selection:</strong> ${selectionExplanation}
            </p>
            ${
              marketSelectionDetails
                ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${marketSelectionDetails}</p>`
                : ""
            }
          </div>

          <div style="margin-top: 20px;">
            <h4>🎯 Trading Tips for Multiple Markets:</h4>
            <ul style="font-size: 14px; color: #666;">
              <li>Include specific keywords: <strong>"BUY 50 INFLATION YES"</strong></li>
              <li>Use distinctive words from market titles</li>
              <li>Be as specific as possible to avoid confusion</li>
              <li>Check market lists in your email updates</li>
            </ul>
          </div>
        </div>
      `,
        text: `
✅ Purchase Confirmed!

You bought ${transaction.amount} ${side} shares
Market: ${market.title}
Cost: ${Math.abs(transaction.pointsChange)} points
Max Payout: ${maxPayout} points (if ${side} wins)
Potential Profit: ${potentialProfit} points
New Balance: ${user.points} points

Market Selection: ${selectionExplanation}
${marketSelectionDetails}

Trading Tips for Multiple Markets:
- Include specific keywords: "BUY 50 INFLATION YES"
- Use distinctive words from market titles
- Be as specific as possible to avoid confusion
- Check market lists in your email updates
      `,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending transaction confirmation:", error);
    }
  }
}

module.exports = new EmailService();
