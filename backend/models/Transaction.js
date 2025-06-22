const mongoose = require("mongoose")

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    market: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Market",
      required: true,
    },
    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    pointsChange: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    source: {
      type: String,
      enum: ["web", "email"],
      default: "web",
    },
    emailMessageId: String, // For tracking email-based transactions
    notes: String,
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
transactionSchema.index({ user: 1, createdAt: -1 })
transactionSchema.index({ market: 1, createdAt: -1 })
transactionSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Transaction", transactionSchema)
