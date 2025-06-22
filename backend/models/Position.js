const mongoose = require("mongoose")

// Track user positions in markets
const positionSchema = new mongoose.Schema(
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
    sharesYes: {
      type: Number,
      default: 0,
    },
    sharesNo: {
      type: Number,
      default: 0,
    },
    totalInvested: {
      type: Number,
      default: 0,
    },
    averagePrice: {
      type: Number,
      default: 0,
    },
    realizedPnL: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for efficient user-market lookups
positionSchema.index({ user: 1, market: 1 }, { unique: true })

module.exports = mongoose.model("Position", positionSchema)
