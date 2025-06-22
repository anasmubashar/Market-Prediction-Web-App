const EmailCycle = require("../models/EmailCycle")
const User = require("../models/User")
const Market = require("../models/Market")
const emailService = require("../services/emailService")
const { validationResult } = require("express-validator")

// Send market cycle email
exports.sendMarketCycle = async (req, res) => {
  try {
    // Get all active markets
    const markets = await Market.find({ status: "active" }).sort({ createdAt: -1 })

    if (markets.length === 0) {
      return res.status(400).json({ message: "No active markets found" })
    }

    // Get all active users who want email notifications
    const users = await User.find({
      role: "participant",
      isActive: true,
      emailVerified: true,
      "preferences.emailNotifications": true,
      "preferences.marketUpdates": true,
    })

    if (users.length === 0) {
      return res.status(400).json({ message: "No users found for email notifications" })
    }

    // Send emails
    const emailCycle = await emailService.sendMarketCycleEmail(markets, users)

    res.json({
      message: "Market cycle emails sent successfully",
      emailCycle: {
        id: emailCycle._id,
        totalRecipients: emailCycle.stats.totalRecipients,
        sent: emailCycle.stats.sent,
        failed: emailCycle.stats.failed,
      },
    })
  } catch (error) {
    console.error("Send market cycle error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Get email cycles history
exports.getEmailCycles = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const emailCycles = await EmailCycle.find()
      .populate("markets", "title")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await EmailCycle.countDocuments()

    res.json({
      emailCycles,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    })
  } catch (error) {
    console.error("Get email cycles error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Get single email cycle
exports.getEmailCycle = async (req, res) => {
  try {
    const emailCycle = await EmailCycle.findById(req.params.id)
      .populate("markets", "title")
      .populate("recipients.user", "name email")

    if (!emailCycle) {
      return res.status(404).json({ message: "Email cycle not found" })
    }

    res.json(emailCycle)
  } catch (error) {
    console.error("Get email cycle error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Send custom email to users
exports.sendCustomEmail = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { userIds, subject, htmlContent, textContent } = req.body

    // Get users
    const users = await User.find({ _id: { $in: userIds } })

    if (users.length === 0) {
      return res.status(400).json({ message: "No users found" })
    }

    // Create email cycle
    const emailCycle = new EmailCycle({
      title: subject,
      template: { subject, htmlContent, textContent },
      status: "sending",
      stats: { totalRecipients: users.length },
    })

    await emailCycle.save()

    // Send emails
    for (const user of users) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject,
          html: htmlContent.replace("{{USER_NAME}}", user.name).replace("{{USER_POINTS}}", user.points),
          text: textContent.replace("{{USER_NAME}}", user.name).replace("{{USER_POINTS}}", user.points),
        }

        await emailService.transporter.sendMail(mailOptions)

        emailCycle.recipients.push({
          user: user._id,
          email: user.email,
          status: "sent",
          sentAt: new Date(),
        })
        emailCycle.stats.sent += 1
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error)

        emailCycle.recipients.push({
          user: user._id,
          email: user.email,
          status: "failed",
          error: error.message,
        })
        emailCycle.stats.failed += 1
      }
    }

    emailCycle.status = "completed"
    await emailCycle.save()

    res.json({
      message: "Custom emails sent",
      emailCycle: {
        id: emailCycle._id,
        sent: emailCycle.stats.sent,
        failed: emailCycle.stats.failed,
      },
    })
  } catch (error) {
    console.error("Send custom email error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
