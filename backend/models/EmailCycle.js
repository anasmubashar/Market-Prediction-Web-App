const mongoose = require("mongoose")

const emailCycleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    markets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Market",
      },
    ],
    recipients: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        email: String,
        status: {
          type: String,
          enum: ["pending", "sent", "failed", "bounced"],
          default: "pending",
        },
        sentAt: Date,
        error: String,
      },
    ],
    template: {
      subject: String,
      htmlContent: String,
      textContent: String,
    },
    scheduledFor: Date,
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "completed", "failed"],
      default: "draft",
    },
    stats: {
      totalRecipients: {
        type: Number,
        default: 0,
      },
      sent: {
        type: Number,
        default: 0,
      },
      failed: {
        type: Number,
        default: 0,
      },
      responses: {
        type: Number,
        default: 0,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("EmailCycle", emailCycleSchema)
