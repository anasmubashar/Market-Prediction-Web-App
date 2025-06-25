const mongoose = require("mongoose");

const emailCycleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      // required: true,
    },
    markets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Market",
      },
    ],
    recurrence: {
      frequency: {
        type: String,
        enum: ["none", "daily", "weekly", "monthly"],
        default: "none",
      },
      timeOfDay: {
        type: String, // "14:30" (24-hour format)
        default: null,
      },
      dayOfWeek: {
        type: Number, // 0 = Sunday, 6 = Saturday
        default: null,
      },
      dayOfMonth: {
        type: Number, // 1 to 31
        default: null,
      },
      nextRun: {
        type: Date,
        default: null,
      },
    },
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
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EmailCycle", emailCycleSchema);
