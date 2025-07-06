const nodemailer = require("nodemailer");
const User = require("../models/User");
const Market = require("../models/Market");
const EmailCycle = require("../models/EmailCycle");
const ChartService = require("./chartService");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
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
              <li>Use "SELL [shares]" to sell your shares</li>
              <li>Example: "BUY 50" or "SELL 25 YES"</li>
              <li>You can now trade up to 10,000 points per transaction!</li>
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
          - Reply with SELL [shares] to sell your shares
          - Example: BUY 50 or SELL 25 YES
          - You can now trade up to 10,000 points per transaction!
          
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
      html: htmlContent
        // .replace("{{USER_NAME}}", user.name)
        .replace("{{USER_POINTS}}", user.points),
      text: textContent
        // .replace("{{USER_NAME}}", user.name)
        .replace("{{USER_POINTS}}", user.points),
      attachments,
      headers: {
        "Reply-To": process.env.EMAIL_USER,
        "Message-ID": `<${Date.now()}-${user._id}@predictionmarket.com>`,
      },
    };

    await this.transporter.sendMail(mailOptions);
  }

  async generateMarketEmailContent(markets) {
    const subject = `Prediction Markets Update - ${markets.length} Active Markets`;
    const attachments = [];

    // Generate charts for each market
    const marketListHtml = await Promise.all(
      markets.map(async (market) => {
        const latestVolume =
          market.volumeHistory?.[market.volumeHistory.length - 1];
        const yesPercentage = latestVolume ? latestVolume.yesPercentage : null;
        const chartBuffer = await ChartService.generateProbabilityChartBuffer(
          market,
          market._id.toString()
        );
        const cid = `chart${market._id}@tusq`;

        attachments.push({
          filename: `chart-${market._id}.png`,
          content: chartBuffer,
          cid,
          contentType: "image/png",
        });

        return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
<h3 style="margin: 0 0 8px 0; color: #1f2937;">${market.title}</h3>

<div style="display: flex; align-items: center; width: 100%;">
  <div style="min-width: 120px; margin-right: 16px;">
            <span style="font-size: 40px; font-weight: 500; color: green;">
              ${yesPercentage}%
            </span>
  </div>
  
  <div style="text-align: right; color: #6b7280; font-size: 14px; margin-left: auto;">

    <div>Volume: ${market.totalVolume}</div>
    <div>YES Price: ${(market.fixedYesPrice * 100).toFixed(
      1
    )} points per share</div>
    <div>NO Price: ${(market.fixedNoPrice * 100).toFixed(
      1
    )} points per share</div>
    <div>Deadline: ${new Date(market.deadline).toLocaleDateString()}</div>
  </div>
</div>

<img src="cid:${cid}" style="max-width: 100%; margin-top: 10px; border-radius: 6px;" />

<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
  <p style="margin: 0; color: #6b7280; font-size: 14px;">
    Reply with: <strong>BUY [amount] YES</strong> or <strong>BUY [amount] NO</strong>
  </p>
</div>
</div>
    `;
      })
    );

    const marketListText = markets.map((market) => {
      return `
Market: ${market.title}
YES Price: ${(market.fixedYesPrice * 100).toFixed(1)} points per share
NO Price: ${(market.fixedNoPrice * 100).toFixed(1)} points per share
Deadline: ${new Date(market.deadline).toLocaleDateString()}
      `;
    });

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello! </h2>
      <p>Here are the current prediction markets with fixed-odds pricing:</p>
      
      <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0;">💰 Your Current Balance: {{USER_POINTS}} points</h3>
      </div>

      ${marketListHtml.join("")}

      <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: sans-serif;">
<h3 style="margin-top: 0;">🎯 How Fixed-Odds Betting Works</h3>
<p>Our prediction markets work like sports betting - you can only <strong>BUY</strong> shares:</p>

<h4 style="margin: 16px 0 8px 0;">📝 Format:</h4>
  <ul style="list-style-type: none; padding-left: 0;">
    <li><strong>BUY [amount] [market hint] [YES|NO]</strong></li>
  </ul>

  <h4 style="margin: 16px 0 8px 0;">💡 Examples:</h4>
  <ul style="list-style-type: disc; padding-left: 20px;">
    <li><strong>BUY 50 Inflation NO</strong> – Spend 50 points to bet against Inflation happening</li>
    <li><strong>BUY 100 Recession YES</strong> – Spend 100 points to bet that Recession will happen</li>
    <li><strong>BUY 2000 Election YES</strong> – Spend 2000 points on Election YES shares</li>
    <li><strong>BUY 75 Election</strong> – Defaults to YES shares for the "Election" market</li>
  </ul>

<p style="color: #065f46; margin: 12px 0 4px 0;">✅ Each share pays out <strong>100 points</strong> if you're right</p>
<p style="color: #065f46; margin: 0 0 12px 0;">✅ Prices are fixed when you buy (no changes)</p>
<p style="color: #065f46; margin: 0 0 12px 0;">✅ You cannot sell shares - only buy and hold until resolution</p>
<p style="color: #065f46; margin: 0 0 12px 0;">✅ You can now trade up to <strong>10,000 points</strong> per transaction!</p>

<h4 style="margin: 16px 0 8px 0;">💡 Example</h4>
<p>If YES shares cost 60 points each and you spend 120 points, you get 2 shares. If the market resolves YES, you get 200 points (2 × 100). Your profit is 80 points!</p>
</div>
  `;

    const textContent = `
Hello!

Your Current Balance: {{USER_POINTS}} points

Current Fixed-Odds Prediction Markets:
${marketListText.join("\n")}

How Fixed-Odds Betting Works:
- You can only BUY shares (no selling)
- BUY [amount] YES or BUY [amount] NO
- Each share pays 100 points if you're right
- Prices are fixed when you trade
- You can now trade up to 10,000 points per transaction!

Example: BUY 50 YES, BUY 100 NO, BUY 2000 YES

Academic Psychology Research Study
Reply "UNSUBSCRIBE" to opt out
  `;

    return { subject, htmlContent, textContent, attachments };
  }

  // Send transaction confirmation email - FIXED VERSION
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

      // 🔧 FIX: Extract side from transaction notes properly
      let side = "YES"; // default
      if (transaction.notes) {
        // Look for "BUY X YES" or "BUY X NO" pattern in notes
        const sideMatch = transaction.notes.match(/BUY\s+[\d.]+\s+(YES|NO)/i);
        if (sideMatch) {
          side = sideMatch[1].toUpperCase();
        } else if (transaction.notes.includes("NO")) {
          side = "NO";
        } else if (transaction.notes.includes("YES")) {
          side = "YES";
        }
      }

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
              <li>You can now trade up to 10,000 points per transaction!</li>
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
- You can now trade up to 10,000 points per transaction!
      `,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending transaction confirmation:", error);
    }
  }
}

module.exports = new EmailService();
