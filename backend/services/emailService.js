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
              <li>Use "BUY [amount]" to buy shares</li>
              <li>Use "SELL [amount]" to sell shares</li>
              <li>Example: "BUY 50" or "SELL 25"</li>
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
          
          starting balance: 1000 points
          
          How to participate:
          - Reply to emails with BUY [amount] or SELL [amount]
          - Example: BUY 50 or SELL 25
          
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

  // Generate market email content with ASCII charts
  async generateMarketEmailContent(markets) {
    const subject = `Prediction Markets Update - ${markets.length} Active Markets`;
    const attachments = [];
    // Generate charts for each market
    const marketListHtml = await Promise.all(
      markets.map(async (market) => {
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
    <div style="min-width: 120px; margin-right: 16px; margin-bottom: 8px;">
      <span style="font-size: 24px; font-weight: bold; color: #4f46e5;">
        ${market.currentProbability}%
      </span>
      <span style="color: #6b7280; margin-left: 4px;">probability</span>
    </div>
    
    <div style="text-align: right; color: #6b7280; font-size: 14px; margin-left: auto;">
      <div>Volume: ${market.totalVolume}</div>
      <div>Deadline: ${new Date(market.deadline).toLocaleDateString()}</div>
    </div>
  </div>

  <img src="cid:${cid}" style="max-width: 100%; margin-top: 10px; border-radius: 6px;" />
  
  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
    <p style="margin: 0; color: #6b7280; font-size: 14px;">
      Reply with: <strong>BUY [amount]</strong> or <strong>SELL [amount]</strong>
    </p>
  </div>
</div>

      `;
      })
    );

    const marketListText = await Promise.all(
      markets.map(async (market) => {
        return `
${market.title}
Current Probability: ${market.currentProbability}%
Volume: ${market.totalVolume} | Deadline: ${new Date(
          market.deadline
        ).toLocaleDateString()}


Reply with: BUY [amount] or SELL [amount]
---
      `;
      })
    );

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello! </h2>
        <p>Here are the current prediction markets and their probabilities:</p>
        
        <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0;">💰 Your Current Balance: {{USER_POINTS}} points</h3>
        </div>

        ${(await Promise.all(marketListHtml)).join("")}

        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: sans-serif;">
  <h3 style="margin-top: 0;"> How to Trade</h3>
  <p>To place a trade, simply reply to this email with one of the following commands:</p>

  <ul style="list-style-type: none; padding-left: 0;">
    <li><strong>BUY 50</strong> – Buys 50 shares</li>
    <li><strong>SELL 25</strong> – Sells 25 shares</li>
  </ul>

  <p style="color: #065f46; margin: 12px 0 4px 0;">✅ You can type in any case — uppercase or lowercase (e.g., <em>buy 50</em>, <em>SELL 25</em>)</p>
  <p style="color: #065f46; margin: 0 0 12px 0;">✅ Optional: Include the <strong>market name</strong> to specify which market you're trading in. This helps avoid confusion, especially if multiple markets are listed.</p>

  <h4 style="margin: 16px 0 8px 0;">📌 Example With Market Name</h4>
  <p>If you see a market like:</p>
  <div style="background-color: #e0f2fe; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
    <strong>Will Trump win elections</strong><br>
    <span style="color: #1e40af;">Probability: 59%</span>
  </div>
  <p>You can reply with:</p>
  <div style="background-color: #fef3c7; padding: 12px; border-radius: 6px;">
    <code style="font-size: 15px;">BUY 50 trump elections</code>
  </div>
  <p style="margin-top: 8px;">This tells the system exactly which market you’re referring to — helpful when there are multiple markets in one email.</p>
</div>

    `;

    const textContent = `
Hello!

Your Current Balance: {{USER_POINTS}} points

Current Prediction Markets:
${(await Promise.all(marketListText)).join("\n")}

How to Trade:
- Reply to this email with your command
- BUY 50 (to buy 50 shares)
- SELL 25 (to sell 25 shares)

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
    marketSelectionMethod = "unknown"
  ) {
    try {
      const action = transaction.type === "BUY" ? "purchased" : "sold";
      const pointsText =
        transaction.pointsChange > 0
          ? `+${transaction.pointsChange}`
          : transaction.pointsChange;

      // Market selection explanation
      let selectionExplanation = "";
      switch (marketSelectionMethod) {
        case "hint":
          selectionExplanation =
            "✅ Market selected based on your keyword hint";
          break;
        case "single_active":
          selectionExplanation = "ℹ️ Only one active market available";
          break;
        case "last_email_cycle":
          selectionExplanation =
            "📧 Market selected from your last email update";
          break;
        case "most_recent":
          selectionExplanation = "🕒 Most recently created active market used";
          break;
        default:
          selectionExplanation = "🎯 Market automatically selected";
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: `✅ Trade Confirmed: ${transaction.type} ${transaction.amount} shares`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>✅ Transaction Confirmed!</h2>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>You ${action} ${transaction.amount} shares</h3>
            <p><strong>Market:</strong> ${market.title}</p>
            <p><strong>Price:</strong> ${transaction.price}%</p>
            <p><strong>Points Change:</strong> ${pointsText}</p>
            <p><strong>New Balance:</strong> ${user.points} points</p>
          </div>

          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              ${selectionExplanation}
            </p>
          </div>

          <div style="margin-top: 20px;">
            <h4>💡 Pro Tips:</h4>
            <ul style="font-size: 14px; color: #666;">
              <li>Include market keywords: <strong>"BUY 50 INFLATION"</strong></li>
              <li>Check multiple markets in your email updates</li>
              <li>Reply quickly after receiving market emails</li>
            </ul>
          </div>
        </div>
      `,
        text: `
✅ Transaction Confirmed!

You ${action} ${transaction.amount} shares
Market: ${market.title}
Price: ${transaction.price}%
Points Change: ${pointsText}
New Balance: ${user.points} points

${selectionExplanation}

Pro Tips:
- Include market keywords: "BUY 50 INFLATION"
- Check multiple markets in your email updates
      `,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending transaction confirmation:", error);
    }
  }
}

module.exports = new EmailService();
