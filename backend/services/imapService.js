const Imap = require("node-imap");
const { simpleParser } = require("mailparser");
const User = require("../models/User");
const Market = require("../models/Market");
const Transaction = require("../models/Transaction");
const emailService = require("./emailService");
const FixedMarketService = require("./fixedMarketService");
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
        text: `\nYou have been successfully unsubscribed from prediction market emails.\n\nThank you for participating in our research study.`,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ User ${user.email} unsubscribed successfully`);
    } catch (error) {
      console.error("Error handling unsubscribe:", error);
    }
  }

  parseCommands(content) {
    const commands = [];

    const cleanContent = content
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\s+/g, " ")
      .replace(/\bon\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, "")
      .replace(/\b\d{1,2}\s+\w{3,9}\s+\d{4}\b/gi, "")
      .replace(/\bat\s+\d{1,2}:\d{2}\b/gi, "")
      .replace(/^>.*$/gm, " ")
      .replace(/wrote:[\s\S]*$/i, " ")
      .trim();

    const parts = cleanContent.split(/[\n\r\t,;.!?]/);

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart || trimmedPart.length > 100) continue;

      // Enhanced pattern to capture market hints better
      // Matches: BUY 50 [market hint] [YES/NO]
      const pattern = /^BUY\s+(\d+)(?:\s+([a-zA-Z\s]+?))?(?:\s+(YES|NO))?$/i;
      const match = trimmedPart.match(pattern);

      if (match) {
        const amount = Number(match[1]);
        let marketHint = match[2] ? match[2].trim() : null;
        let side = match[3] ? match[3].toUpperCase() : "YES"; // default YES

        // If no explicit YES/NO, check if the last word of market hint is YES/NO
        if (!match[3] && marketHint) {
          const words = marketHint.split(/\s+/);
          const lastWord = words[words.length - 1].toUpperCase();
          if (lastWord === "YES" || lastWord === "NO") {
            side = lastWord;
            marketHint = words.slice(0, -1).join(" ").trim();
            if (!marketHint) marketHint = null;
          }
        }

        commands.push({
          action: "BUY",
          amount,
          marketHint,
          side,
        });
      }
    }

    return commands;
  }

  async processCommand(user, command, messageId) {
    try {
      if (!user.preferences.emailNotifications) return;

      let market;
      let marketSelectionMethod = "unknown";
      let marketSelectionDetails = "";

      console.log(`🔍 Processing command for ${user.email}:`, command);

      // Step 1: Try to find market using hint
      if (command.marketHint) {
        const cleanHint = command.marketHint.replace(/[^\w\s]/g, "").trim();
        console.log(`🔍 Looking for market with hint: "${cleanHint}"`);

        // Try exact title match first
        market = await Market.findOne({
          title: { $regex: `^${cleanHint}$`, $options: "i" },
          status: "active",
        });

        if (market) {
          marketSelectionMethod = "exact_title_match";
          marketSelectionDetails = `Exact match for "${cleanHint}"`;
        } else {
          // Try partial match
          market = await Market.findOne({
            title: { $regex: cleanHint, $options: "i" },
            status: "active",
          });

          if (market) {
            marketSelectionMethod = "partial_title_match";
            marketSelectionDetails = `Partial match for "${cleanHint}" in "${market.title}"`;
          } else {
            // Try keyword matching
            const keywords = cleanHint.split(/\s+/);
            const keywordRegex = keywords
              .map((word) => `(?=.*${word})`)
              .join("");

            market = await Market.findOne({
              title: { $regex: keywordRegex, $options: "i" },
              status: "active",
            });

            if (market) {
              marketSelectionMethod = "keyword_match";
              marketSelectionDetails = `Keyword match for "${cleanHint}" in "${market.title}"`;
            }
          }
        }
      }

      // Step 2: Fallback strategies if no hint match
      if (!market) {
        const activeMarkets = await Market.find({ status: "active" }).sort({
          createdAt: -1,
        });

        console.log(`📊 Found ${activeMarkets.length} active markets`);

        if (activeMarkets.length === 0) {
          await this.sendErrorEmail(
            user,
            "No active markets available for trading."
          );
          return;
        } else if (activeMarkets.length === 1) {
          market = activeMarkets[0];
          marketSelectionMethod = "single_active_market";
          marketSelectionDetails = "Only one active market available";
        } else {
          // Multiple markets - try to use the most recent from email cycle
          const lastEmailCycle = await EmailCycle.findOne()
            .sort({ createdAt: -1 })
            .populate("markets");

          if (lastEmailCycle && lastEmailCycle.markets.length > 0) {
            market = lastEmailCycle.markets.find((m) => m.status === "active");
            if (market) {
              marketSelectionMethod = "last_email_cycle";
              marketSelectionDetails = "Selected from most recent email cycle";
            }
          }

          // Final fallback - most recent active market
          if (!market) {
            market = activeMarkets[0];
            marketSelectionMethod = "most_recent_fallback";
            marketSelectionDetails =
              "Most recently created active market (fallback)";

            // Send warning about ambiguous selection
            await this.sendAmbiguousMarketWarning(
              user,
              command,
              activeMarkets,
              market
            );
          }
        }
      }

      if (!market) {
        await this.sendErrorEmail(
          user,
          "No suitable market found for trading."
        );
        return;
      }

      console.log(
        `✅ Selected market: "${market.title}" via ${marketSelectionMethod}`
      );

      // Check if user has enough points
      if (user.points < command.amount) {
        await this.sendErrorEmail(
          user,
          `Insufficient points. You have ${user.points} but tried to spend ${command.amount}.`
        );
        return;
      }

      // Execute the trade
      const result = await FixedMarketService.buyFixedShares(
        user._id,
        market._id,
        command.side || "YES",
        command.amount
      );

      // 🔧 FIX: Include the side information in transaction notes
      const transaction = new Transaction({
        user: user._id,
        market: market._id,
        type: "BUY",
        amount: result.shares,
        price: result.probability,
        pointsChange: -result.cost,
        source: "email",
        emailMessageId: messageId,
        notes: `BUY ${result.shares} ${
          command.side || "YES"
        } shares - ${marketSelectionMethod}: ${marketSelectionDetails}`,
      });

      await transaction.save();
      user.stats.totalPredictions += 1;
      user.lastActive = new Date();
      await user.save();

      await emailService.sendTransactionConfirmation(
        user,
        transaction,
        market,
        marketSelectionMethod,
        marketSelectionDetails
      );
    } catch (error) {
      console.error("Error processing command:", error);
      await this.sendErrorEmail(
        user,
        "An error occurred while processing your trade."
      );
    }
  }

  async sendAmbiguousMarketWarning(
    user,
    command,
    activeMarkets,
    selectedMarket
  ) {
    try {
      console.log(`⚠️ Sending ambiguous market warning to ${user.email}`);

      const marketList = activeMarkets
        .map((m, index) => `${index + 1}. ${m.title}`)
        .join("\n");

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "⚠️ Multiple Markets Available - Trade Executed",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>⚠️ Multiple Markets Available</h2>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p><strong>Your command:</strong> <code>${command.action} ${
          command.amount
        }${command.marketHint ? ` ${command.marketHint}` : ""} ${
          command.side
        }</code></p>
            <p><strong>We executed your trade in:</strong> "${
              selectedMarket.title
            }"</p>
            ${
              command.marketHint
                ? `<p><strong>Market hint "${command.marketHint}" didn't match any market exactly.</strong></p>`
                : `<p><strong>No market hint provided.</strong></p>`
            }
          </div>

          <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h4>📋 Currently Active Markets:</h4>
            <ol style="margin: 10px 0;">
              ${activeMarkets
                .map((m) => `<li><strong>${m.title}</strong></li>`)
                .join("")}
            </ol>
          </div>

          <div style="background-color: #e3f2fd; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h4>💡 To Trade in Specific Markets:</h4>
            <ul>
              <li><strong>BUY 50 ${
                activeMarkets[0].title.split(" ")[0]
              } YES</strong> - Use key words from the title</li>
              <li><strong>BUY 50 ${
                activeMarkets[1]
                  ? activeMarkets[1].title.split(" ")[0]
                  : "KEYWORD"
              } NO</strong> - Include distinctive keywords</li>
              <li>Be as specific as possible with market names</li>
            </ul>
          </div>

          <p><strong>Your trade was still executed successfully!</strong> Check your confirmation email for details.</p>
        </div>
      `,
        text: `
⚠️ Multiple Markets Available

Your command: ${command.action} ${command.amount}${
          command.marketHint ? ` ${command.marketHint}` : ""
        } ${command.side}
We executed your trade in: "${selectedMarket.title}"
${
  command.marketHint
    ? `Market hint "${command.marketHint}" didn't match any market exactly.`
    : `No market hint provided.`
}

Currently Active Markets:
${marketList}

To Trade in Specific Markets:
- BUY 50 ${
          activeMarkets[0].title.split(" ")[0]
        } YES - Use key words from the title
- BUY 50 ${
          activeMarkets[1] ? activeMarkets[1].title.split(" ")[0] : "KEYWORD"
        } NO - Include distinctive keywords
- Be as specific as possible with market names

Your trade was still executed successfully! Check your confirmation email for details.
      `,
      };

      await emailService.transporter.sendMail(mailOptions);
      console.log(`✅ Ambiguous market warning sent to ${user.email}`);
    } catch (error) {
      console.error(
        `❌ Failed to send ambiguous market warning to ${user.email}:`,
        error.message
      );
    }
  }

  async sendDebugEmail(user, originalContent) {
    try {
      console.log(`📧 Sending debug email to ${user.email}`);

      // Get current active markets for examples
      const activeMarkets = await Market.find({ status: "active" }).limit(3);
      const marketExamples =
        activeMarkets.length > 0
          ? activeMarkets
              .map((m) => {
                const keyword = m.title.split(" ")[0];
                return `<li><strong>BUY 50 ${keyword} YES</strong> - Trade in "${m.title}"</li>`;
              })
              .join("")
          : "<li><strong>BUY 50 YES</strong> - No specific market needed</li>";

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
              <li><strong>BUY 50</strong> - Buy shares with 50 points (defaults to YES)</li>
              <li><strong>BUY 50 YES</strong> - Buy YES shares with 50 points</li>
              <li><strong>BUY 50 NO</strong> - Buy NO shares with 50 points</li>
              <li><strong>BUY 2000 YES</strong> - Buy YES shares with 2000 points (up to 10,000 allowed)</li>
              ${marketExamples}
            </ul>
          </div>

          ${
            activeMarkets.length > 1
              ? `
          <div style="margin-top: 20px; background-color: #e3f2fd; padding: 15px; border-radius: 8px;">
            <h4>🎯 Multiple Markets Available:</h4>
            <ul>
              ${activeMarkets
                .map((m) => `<li><strong>${m.title}</strong></li>`)
                .join("")}
            </ul>
            <p><strong>Include keywords</strong> from the market title to specify which one you want to trade in!</p>
          </div>
          `
              : ""
          }

          <div style="margin-top: 20px; background-color: #f0f9ff; padding: 15px; border-radius: 8px;">
            <h4>💡 Fixed-Odds Market Rules:</h4>
            <ul>
              <li>You can only <strong>BUY</strong> shares (no selling)</li>
              <li>Choose YES or NO when you buy</li>
              <li>Shares pay out 100 points each if you're right</li>
              <li>Use numbers between 1 and 10,000 points</li>
              <li>Include market keywords for specific markets</li>
            </ul>
          </div>

          <p>Your current balance: <strong>${user.points} points</strong></p>
          
          <p style="margin-top: 20px;">
            <strong>Try again!</strong> Just reply with "BUY 50 YES" or include market keywords.
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
- BUY 50 (Buy shares with 50 points, defaults to YES)
- BUY 50 YES (Buy YES shares with 50 points)
- BUY 50 NO (Buy NO shares with 50 points)
- BUY 2000 YES (Buy YES shares with 2000 points, up to 10,000 allowed)
${activeMarkets
  .map((m) => `- BUY 50 ${m.title.split(" ")[0]} YES (Trade in "${m.title}")`)
  .join("\n")}

${
  activeMarkets.length > 1
    ? `
Multiple Markets Available:
${activeMarkets.map((m) => `- ${m.title}`).join("\n")}

Include keywords from the market title to specify which one you want to trade in!
`
    : ""
}

Fixed-Odds Market Rules:
- You can only BUY shares (no selling)
- Choose YES or NO when you buy
- Shares pay out 100 points each if you're right
- Use numbers between 1 and 10,000 points
- Include market keywords for specific markets

Your current balance: ${user.points} points

Try again! Just reply with "BUY 50 YES" or include market keywords.
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
              <li>Use format: <strong>BUY [amount]</strong> or <strong>SELL [shares]</strong></li>
              <li>Check your point balance before buying</li>
              <li>Check your share holdings before selling</li>
              <li>Include market keywords for specific markets</li>
              <li>Amount limit is now 10,000 points per trade</li>
            </ul>
          </div>
          <p>Your current balance: <strong>${user.points} points</strong></p>
        </div>
      `,
        text: `
Trade Error: ${errorMessage}

Tips:
- Use format: BUY [amount]
- Check your balance: ${user.points} points
- Include market keywords for specific markets
- Amount limit is now 10,000 points per trade
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
