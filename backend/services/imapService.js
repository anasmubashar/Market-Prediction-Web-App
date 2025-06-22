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
      // Attempt to reconnect after 30 seconds
      setTimeout(() => this.connect(), 30000);
    });

    this.imap.once("end", () => {
      console.log("IMAP connection ended");
      this.isConnected = false;
      // Attempt to reconnect after 10 seconds
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
    // Listen for new emails
    this.imap.on("mail", (numNewMsgs) => {
      console.log(`${numNewMsgs} new email(s) received`);
      this.fetchNewEmails();
    });

    // Initial fetch of recent emails (but only from today to avoid processing old emails)
    this.fetchNewEmails();
  }

  fetchNewEmails() {
    // Search for unseen emails from today only (to avoid processing old emails)
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
        markSeen: false, // Don't mark as seen until we process them
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

      // Extract sender email
      const senderEmail = parsed.from.value[0].address;

      // Check if this is from a registered user FIRST
      const user = await User.findOne({ email: senderEmail });
      if (!user) {
        console.log(`📧 Skipping email from non-participant: ${senderEmail}`);
        this.markEmailAsSeen(seqno);
        return;
      }

      console.log(`📧 Processing email from registered user: ${senderEmail}`);

      // Extract email content
      const content = parsed.text || parsed.html || "";

      // Check for unsubscribe request
      if (this.isUnsubscribeRequest(content)) {
        await this.handleUnsubscribe(user);
        this.markEmailAsSeen(seqno);
        return;
      }

      // Parse trading commands
      const commands = this.parseCommands(content);

      if (commands.length === 0) {
        console.log(
          `📧 No valid trading commands found in email from ${senderEmail}`
        );
        // Don't send error emails for emails without commands - just mark as seen
        this.markEmailAsSeen(seqno);
        return;
      }

      console.log(
        `📧 Found ${commands.length} valid trading command(s) from ${senderEmail}:`,
        commands
      );

      // Process each command
      for (const command of commands) {
        await this.processCommand(user, command, parsed.messageId);
      }

      // Mark email as processed
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
    // Clean the content - remove HTML tags and extra whitespace
    const cleanContent = content
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    const lines = cleanContent.split("\n");

    // Check for explicit unsubscribe commands at the start of lines
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();

      // Only trigger on explicit, standalone unsubscribe commands
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

      // Send confirmation email
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

    // Clean the content - remove HTML tags and extra whitespace
    const cleanContent = content
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    const lines = cleanContent.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines or lines that are too long (likely not commands)
      if (!trimmedLine || trimmedLine.length > 100) continue;

      const upperLine = trimmedLine.toUpperCase();

      // Very strict patterns - must be at start of line or after whitespace
      // and must be followed by a number
      const buyMatch = upperLine.match(/^BUY\s+(\d+)(?:\s+(.+))?$/);
      const sellMatch = upperLine.match(/^SELL\s+(\d+)(?:\s+(.+))?$/);

      if (buyMatch) {
        const amount = Number.parseInt(buyMatch[1]);
        // Validate reasonable amount (1-1000)
        if (amount >= 1 && amount <= 1000) {
          commands.push({
            action: "BUY",
            amount: amount,
            marketHint: buyMatch[2] ? buyMatch[2].trim() : null,
          });
        }
      } else if (sellMatch) {
        const amount = Number.parseInt(sellMatch[1]);
        // Validate reasonable amount (1-1000)
        if (amount >= 1 && amount <= 1000) {
          commands.push({
            action: "SELL",
            amount: amount,
            marketHint: sellMatch[2] ? sellMatch[2].trim() : null,
          });
        }
      }
    }

    return commands;
  }

  async processCommand(user, command, messageId) {
    try {
      // Find the most likely market
      let market;
      let marketSelectionMethod = "unknown";

      if (command.marketHint) {
        // Try to find market by hint (fuzzy search)
        market = await Market.findOne({
          title: { $regex: command.marketHint, $options: "i" },
          status: "active",
        });
        marketSelectionMethod = "hint";
      }

      if (!market) {
        // Get all active markets
        const activeMarkets = await Market.find({ status: "active" }).sort({
          createdAt: -1,
        });

        if (activeMarkets.length === 0) {
          console.log("❌ No active markets found");
          await this.sendErrorEmail(
            user,
            "No active markets available for trading."
          );
          return;
        }

        if (activeMarkets.length === 1) {
          // Only one market - use it
          market = activeMarkets[0];
          marketSelectionMethod = "single_active";
        } else {
          // Multiple markets - use the one featured in the last email cycle
          const lastEmailCycle = await EmailCycle.findOne()
            .sort({ createdAt: -1 })
            .populate("markets");

          if (lastEmailCycle && lastEmailCycle.markets.length > 0) {
            // Use the first market from the last email cycle
            market =
              lastEmailCycle.markets.find((m) => m.status === "active") ||
              activeMarkets[0];
            marketSelectionMethod = "last_email_cycle";
          } else {
            // Fallback to most recent market
            market = activeMarkets[0];
            marketSelectionMethod = "most_recent";
          }
        }
      }

      // Validate transaction
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

      // Calculate points change using LMSR
      let transactionResult;
      if (command.action === "BUY") {
        transactionResult = LMSRService.calculateSharesForBudget(
          market.lmsr.sharesYes,
          market.lmsr.sharesNo,
          command.amount,
          "YES", // Default to YES for email commands
          market.lmsr.beta
        );
      } else {
        // For SELL, we need to check user's position first
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

      // Create transaction
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

      // Update user points and stats
      user.points += pointsChange;
      user.stats.totalPredictions += 1;
      user.lastActive = new Date();
      await user.save();

      // Update market stats and probability using LMSR
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

      // Update user position
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

      // Send confirmation email with market selection info
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

  // Add error email method
  async sendErrorEmail(user, errorMessage) {
    try {
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
    } catch (error) {
      console.error("Error sending error email:", error);
    }
  }

  async resubscribeUser(userEmail) {
    try {
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        console.log(`User not found: ${userEmail}`);
        return false;
      }

      user.preferences.emailNotifications = true;
      user.preferences.marketUpdates = true;
      await user.save();

      // Send re-subscription confirmation
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "Re-subscribed to Prediction Market",
        text: `Hello ${user.name},\n\nYou have been re-subscribed to prediction market emails.\n\nYou can now participate in trading again by replying to market emails with BUY/SELL commands.\n\nYour current balance: ${user.points} points`,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ User ${user.email} re-subscribed successfully`);
      return true;
    } catch (error) {
      console.error("Error re-subscribing user:", error);
      return false;
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
