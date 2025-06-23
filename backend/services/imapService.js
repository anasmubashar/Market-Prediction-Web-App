const Imap = require("node-imap");
const { simpleParser } = require("mailparser");
const User = require("../models/User");
const Market = require("../models/Market");
const Transaction = require("../models/Transaction");
const emailService = require("./emailService");
const LMSRService = require("./lmsrService");
const Position = require("../models/Position");
const EmailCycle = require("../models/EmailCycle");

class ImapService {
  constructor() {
    this.imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT || 993,
      tls: process.env.IMAP_TLS === "true",
      tlsOptions: { rejectUnauthorized: false },
    });

    this.isConnected = false;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.imap.once("ready", () => {
      console.log("IMAP connection ready");
      this.isConnected = true;
      this.openInbox();
    });

    this.imap.once("error", (err) => {
      console.error("IMAP connection error:", err);
      this.isConnected = false;
      setTimeout(() => this.connect(), 30000);
    });

    this.imap.once("end", () => {
      console.log("IMAP connection ended");
      this.isConnected = false;
      setTimeout(() => this.connect(), 10000);
    });
  }

  connect() {
    if (!this.isConnected) {
      console.log("Connecting to IMAP server...");
      this.imap.connect();
    }
  }

  openInbox() {
    this.imap.openBox("INBOX", false, (err, box) => {
      if (err) {
        console.error("Error opening inbox:", err);
        return;
      }

      console.log("Inbox opened, monitoring for new emails...");
      this.monitorNewEmails();
    });
  }

  monitorNewEmails() {
    this.imap.on("mail", (numNewMsgs) => {
      console.log(`${numNewMsgs} new email(s) received`);
      this.fetchNewEmails();
    });

    this.fetchNewEmails();
  }

  fetchNewEmails() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.imap.search(["UNSEEN", ["SINCE", today]], (err, results) => {
      if (err) {
        console.error("Error searching emails:", err);
        return;
      }

      if (results.length === 0) {
        console.log("No new emails to process");
        return;
      }

      console.log(`Found ${results.length} new email(s) to process`);

      const fetch = this.imap.fetch(results, {
        bodies: "",
        markSeen: false,
      });

      fetch.on("message", (msg, seqno) => {
        let buffer = "";

        msg.on("body", (stream, info) => {
          stream.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
          });

          stream.once("end", () => {
            this.processEmail(buffer, seqno);
          });
        });
      });

      fetch.once("error", (err) => {
        console.error("Fetch error:", err);
      });
    });
  }

  async processEmail(rawEmail, seqno) {
    try {
      const parsed = await simpleParser(rawEmail);
      const senderEmail = parsed.from.value[0].address;

      console.log(`📧 Processing email from: ${senderEmail}`);
      console.log(`📧 Subject: ${parsed.subject}`);

      const user = await User.findOne({ email: senderEmail });
      if (!user) {
        console.log(`📧 Skipping email from non-participant: ${senderEmail}`);
        this.markEmailAsSeen(seqno);
        return;
      }

      console.log(`📧 Processing email from registered user: ${senderEmail}`);
      console.log(
        `📧 User preferences - Notifications: ${user.preferences.emailNotifications}, Updates: ${user.preferences.marketUpdates}`
      );

      // Get both text and HTML content for debugging
      const textContent = parsed.text || "";
      const htmlContent = parsed.html || "";

      console.log(`📧 Email text content:`);
      console.log(`"${textContent}"`);
      console.log(`📧 Email HTML content:`);
      console.log(`"${htmlContent}"`);

      // Try parsing from both text and HTML
      const content = textContent || htmlContent;

      if (this.isUnsubscribeRequest(content)) {
        console.log(`📧 Unsubscribe request detected from ${senderEmail}`);
        await this.handleUnsubscribe(user);
        this.markEmailAsSeen(seqno);
        return;
      }

      const commands = this.parseCommands(content);

      console.log(`📧 Parsed commands:`, commands);

      if (commands.length === 0) {
        console.log(
          `📧 No valid trading commands found in email from ${senderEmail}`
        );
        console.log(`📧 Full email content for debugging:`);
        console.log(`Text: "${textContent}"`);
        console.log(`HTML: "${htmlContent}"`);

        // Send debug email to help user
        await this.sendDebugEmail(user, content);
        this.markEmailAsSeen(seqno);
        return;
      }

      console.log(
        `📧 Found ${commands.length} valid trading command(s) from ${senderEmail}:`,
        commands
      );

      for (const command of commands) {
        await this.processCommand(user, command, parsed.messageId);
      }

      this.markEmailAsSeen(seqno);
    } catch (error) {
      console.error("Error processing email:", error);
      this.markEmailAsSeen(seqno);
    }
  }

  markEmailAsSeen(seqno) {
    try {
      this.imap.addFlags(seqno, ["\\Seen"], (err) => {
        if (err) {
          console.error("Error marking email as seen:", err);
        }
      });
    } catch (error) {
      console.error("Error in markEmailAsSeen:", error);
    }
  }

  isUnsubscribeRequest(content) {
    const cleanContent = content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const lines = cleanContent.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();

      if (
        trimmedLine === "unsubscribe" ||
        trimmedLine === "stop" ||
        trimmedLine === "opt out" ||
        trimmedLine === "remove me" ||
        (trimmedLine.startsWith("unsubscribe") && trimmedLine.length < 20)
      ) {
        return true;
      }
    }

    return false;
  }

  async handleUnsubscribe(user) {
    try {
      user.preferences.emailNotifications = false;
      user.preferences.marketUpdates = false;
      await user.save();

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "Unsubscribed from Prediction Market",
        text: `Hello ${user.name},\n\nYou have been successfully unsubscribed from prediction market emails.\n\nThank you for participating in our research study.`,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ User ${user.email} unsubscribed successfully`);
    } catch (error) {
      console.error("Error handling unsubscribe:", error);
    }
  }

  parseCommands(content) {
    const commands = [];

    console.log(`🔍 Parsing commands from content: "${content}"`);

    // Clean the content more aggressively
    const cleanContent = content
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Remove HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n")
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    console.log(`🔍 Cleaned content: "${cleanContent}"`);

    // Split by various delimiters and check each part
    const parts = cleanContent.split(/[\n\r\t,;.!?]/);

    for (const part of parts) {
      const trimmedPart = part.trim();

      if (!trimmedPart || trimmedPart.length > 100) continue;

      console.log(`🔍 Checking part: "${trimmedPart}"`);

      const upperPart = trimmedPart.toUpperCase();

      // More flexible regex patterns
      const buyPatterns = [
        /^BUY\s+(\d+)(?:\s+(.+))?$/i,
        /^B\s+(\d+)(?:\s+(.+))?$/i,
        /(\d+)\s*BUY/i,
        /BUY.*?(\d+)/i,
      ];

      const sellPatterns = [
        /^SELL\s+(\d+)(?:\s+(.+))?$/i,
        /^S\s+(\d+)(?:\s+(.+))?$/i,
        /(\d+)\s*SELL/i,
        /SELL.*?(\d+)/i,
      ];

      // Try buy patterns
      for (const pattern of buyPatterns) {
        const match = trimmedPart.match(pattern);
        if (match) {
          const amount = Number.parseInt(match[1]);
          if (amount >= 1 && amount <= 1000) {
            console.log(`✅ Found BUY command: ${amount}`);
            commands.push({
              action: "BUY",
              amount: amount,
              marketHint: match[2] ? match[2].trim() : null,
            });
            break;
          }
        }
      }

      // Try sell patterns
      for (const pattern of sellPatterns) {
        const match = trimmedPart.match(pattern);
        if (match) {
          const amount = Number.parseInt(match[1]);
          if (amount >= 1 && amount <= 1000) {
            console.log(`✅ Found SELL command: ${amount}`);
            commands.push({
              action: "SELL",
              amount: amount,
              marketHint: match[2] ? match[2].trim() : null,
            });
            break;
          }
        }
      }

      // Simple word-based parsing as fallback
      const words = upperPart.split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        if (
          (words[i] === "BUY" || words[i] === "B") &&
          /^\d+$/.test(words[i + 1])
        ) {
          const amount = Number.parseInt(words[i + 1]);
          if (amount >= 1 && amount <= 1000) {
            console.log(`✅ Found BUY command (word-based): ${amount}`);
            commands.push({
              action: "BUY",
              amount: amount,
              marketHint: words.slice(i + 2).join(" ") || null,
            });
          }
        }
        if (
          (words[i] === "SELL" || words[i] === "S") &&
          /^\d+$/.test(words[i + 1])
        ) {
          const amount = Number.parseInt(words[i + 1]);
          if (amount >= 1 && amount <= 1000) {
            console.log(`✅ Found SELL command (word-based): ${amount}`);
            commands.push({
              action: "SELL",
              amount: amount,
              marketHint: words.slice(i + 2).join(" ") || null,
            });
          }
        }
      }
    }

    // Remove duplicates
    const uniqueCommands = commands.filter(
      (command, index, self) =>
        index ===
        self.findIndex(
          (c) => c.action === command.action && c.amount === command.amount
        )
    );

    console.log(`🔍 Final parsed commands:`, uniqueCommands);
    return uniqueCommands;
  }

  async sendDebugEmail(user, originalContent) {
    try {
      console.log(`📧 Sending debug email to ${user.email}`);

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "Command Not Recognized - Prediction Market",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🤖 Command Not Recognized</h2>
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p><strong>We couldn't understand your trading command.</strong></p>
            <p>Your message: <code>"${originalContent.substring(0, 200)}${
          originalContent.length > 200 ? "..." : ""
        }"</code></p>
          </div>
          
          <div style="margin-top: 20px;">
            <h3>✅ Correct Format Examples:</h3>
            <ul style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              <li><strong>BUY 50</strong> - Buy 50 shares</li>
              <li><strong>SELL 25</strong> - Sell 25 shares</li>
              <li><strong>BUY 100 INFLATION</strong> - Buy 100 shares in inflation market</li>
              <li><strong>B 75</strong> - Short form for buy</li>
              <li><strong>S 30</strong> - Short form for sell</li>
            </ul>
          </div>

          <div style="margin-top: 20px; background-color: #e3f2fd; padding: 15px; border-radius: 8px;">
            <h4>💡 Tips:</h4>
            <ul>
              <li>Keep it simple: just "BUY 50" or "SELL 25"</li>
              <li>Use numbers between 1 and 1000</li>
              <li>Avoid extra formatting or signatures</li>
              <li>Reply directly to market emails</li>
            </ul>
          </div>

          <p>Your current balance: <strong>${user.points} points</strong></p>
          
          <p style="margin-top: 20px;">
            <strong>Try again!</strong> Just reply with a simple command like "BUY 50"
          </p>
        </div>
      `,
        text: `
Command Not Recognized

We couldn't understand your trading command.
Your message: "${originalContent.substring(0, 200)}${
          originalContent.length > 200 ? "..." : ""
        }"

Correct Format Examples:
- BUY 50 (Buy 50 shares)
- SELL 25 (Sell 25 shares)
- BUY 100 INFLATION (Buy 100 shares in inflation market)

Tips:
- Keep it simple: just "BUY 50" or "SELL 25"
- Use numbers between 1 and 1000
- Avoid extra formatting or signatures

Your current balance: ${user.points} points

Try again! Just reply with a simple command like "BUY 50"
      `,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ Debug email sent successfully to ${user.email}`);
    } catch (error) {
      console.error(
        `❌ Failed to send debug email to ${user.email}:`,
        error.message
      );
    }
  }

  async processCommand(user, command, messageId) {
    try {
      console.log(
        `🔄 Processing command: ${command.action} ${command.amount} for user ${user.email}`
      );

      // Check if user can receive emails
      if (!user.preferences.emailNotifications) {
        console.log(
          `⚠️ User ${user.email} has email notifications disabled - skipping error email`
        );
        return;
      }

      let market;
      let marketSelectionMethod = "unknown";

      if (command.marketHint) {
        market = await Market.findOne({
          title: { $regex: command.marketHint, $options: "i" },
          status: "active",
        });
        marketSelectionMethod = "hint";
      }

      if (!market) {
        const activeMarkets = await Market.find({ status: "active" }).sort({
          createdAt: -1,
        });

        if (activeMarkets.length === 0) {
          console.log(
            `❌ No active markets found - sending error email to ${user.email}`
          );
          await this.sendErrorEmail(
            user,
            "No active markets available for trading."
          );
          return;
        }

        if (activeMarkets.length === 1) {
          market = activeMarkets[0];
          marketSelectionMethod = "single_active";
        } else {
          const lastEmailCycle = await EmailCycle.findOne()
            .sort({ createdAt: -1 })
            .populate("markets");

          if (lastEmailCycle && lastEmailCycle.markets.length > 0) {
            market =
              lastEmailCycle.markets.find((m) => m.status === "active") ||
              activeMarkets[0];
            marketSelectionMethod = "last_email_cycle";
          } else {
            market = activeMarkets[0];
            marketSelectionMethod = "most_recent";
          }
        }
      }

      if (command.action === "BUY" && user.points < command.amount) {
        console.log(
          `❌ User ${user.email} has insufficient points for BUY ${command.amount}`
        );
        await this.sendErrorEmail(
          user,
          `Insufficient points. You have ${user.points} points but tried to spend ${command.amount}.`
        );
        return;
      }

      // Continue with transaction processing...
      let transactionResult;
      if (command.action === "BUY") {
        transactionResult = LMSRService.calculateSharesForBudget(
          market.lmsr.sharesYes,
          market.lmsr.sharesNo,
          command.amount,
          "YES",
          market.lmsr.beta
        );
      } else {
        const position = await Position.findOne({
          user: user._id,
          market: market._id,
        });
        if (!position || position.sharesYes < command.amount) {
          await this.sendErrorEmail(
            user,
            `Insufficient shares to sell. You have ${
              position?.sharesYes || 0
            } YES shares.`
          );
          return;
        }

        transactionResult = LMSRService.calculateSellProceeds(
          market.lmsr.sharesYes,
          market.lmsr.sharesNo,
          command.amount,
          "YES",
          market.lmsr.beta
        );
      }

      const pointsChange =
        command.action === "BUY"
          ? -transactionResult.cost || -command.amount
          : transactionResult.proceeds || command.amount;

      const transaction = new Transaction({
        user: user._id,
        market: market._id,
        type: command.action,
        amount:
          command.action === "BUY"
            ? transactionResult.shares || command.amount
            : command.amount,
        price: market.currentProbability,
        pointsChange,
        source: "email",
        emailMessageId: messageId,
        notes: `Market selected by: ${marketSelectionMethod}`,
      });

      await transaction.save();

      user.points += pointsChange;
      user.stats.totalPredictions += 1;
      user.lastActive = new Date();
      await user.save();

      if (command.action === "BUY") {
        market.lmsr.sharesYes += transactionResult.shares || command.amount;
        market.currentProbability =
          transactionResult.newPrice ||
          Math.min(100, market.currentProbability + command.amount / 100);
      } else {
        market.lmsr.sharesYes -= command.amount;
        market.currentProbability =
          transactionResult.newPrice ||
          Math.max(0, market.currentProbability - command.amount / 100);
      }

      market.totalVolume += Math.abs(pointsChange);
      market.lmsr.costFunction = LMSRService.calculateCostFunction(
        market.lmsr.sharesYes,
        market.lmsr.sharesNo,
        market.lmsr.beta
      );
      await market.save();

      let position = await Position.findOne({
        user: user._id,
        market: market._id,
      });
      if (!position) {
        position = new Position({ user: user._id, market: market._id });
      }

      if (command.action === "BUY") {
        position.sharesYes += transactionResult.shares || command.amount;
        position.totalInvested += Math.abs(pointsChange);
      } else {
        position.sharesYes -= command.amount;
        position.realizedPnL += pointsChange;
      }
      await position.save();

      await emailService.sendTransactionConfirmation(
        user,
        transaction,
        market,
        marketSelectionMethod
      );

      console.log(
        `✅ Processed ${command.action} ${command.amount} for ${user.email} on market: ${market.title} (selected by: ${marketSelectionMethod})`
      );
    } catch (error) {
      console.error("Error processing command:", error);
      await this.sendErrorEmail(
        user,
        "An error occurred processing your trade. Please try again."
      );
    }
  }

  async sendErrorEmail(user, errorMessage) {
    try {
      console.log(`📧 Sending error email to ${user.email}: ${errorMessage}`);

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "Trade Error - Prediction Market",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>❌ Trade Error</h2>
          <div style="background-color: #fee; padding: 20px; border-radius: 8px; border-left: 4px solid #f56565;">
            <p><strong>Error:</strong> ${errorMessage}</p>
          </div>
          <div style="margin-top: 20px;">
            <h3>💡 Tips:</h3>
            <ul>
              <li>Use format: <strong>BUY [amount]</strong> or <strong>SELL [amount]</strong></li>
              <li>Check your point balance before buying</li>
              <li>Check your share holdings before selling</li>
              <li>Include market keywords for specific markets</li>
            </ul>
          </div>
          <p>Your current balance: <strong>${user.points} points</strong></p>
        </div>
      `,
        text: `
Trade Error: ${errorMessage}

Tips:
- Use format: BUY [amount] or SELL [amount]
- Check your balance: ${user.points} points
- Include market keywords for specific markets
      `,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ Error email sent successfully to ${user.email}`);
    } catch (error) {
      console.error(
        `❌ Failed to send error email to ${user.email}:`,
        error.message
      );
    }
  }

  startImapListener() {
    if (process.env.IMAP_USER && process.env.IMAP_PASS) {
      console.log("Starting IMAP email listener...");
      this.connect();
    } else {
      console.log("IMAP credentials not configured, email processing disabled");
    }
  }

  stop() {
    if (this.isConnected) {
      this.imap.end();
    }
  }
}

module.exports = new ImapService();
