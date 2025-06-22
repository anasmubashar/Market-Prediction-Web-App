const mongoose = require("mongoose")

const probabilityHistorySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    probability: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { _id: false },
)

const marketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "closed", "resolved"],
      default: "active",
    },
    currentProbability: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    totalVolume: {
      type: Number,
      default: 0,
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    // LMSR Market Maker fields
    lmsr: {
      // Liquidity parameter (higher = more stable prices)
      beta: {
        type: Number,
        default: 100,
      },
      // Current quantities of YES and NO shares outstanding
      sharesYes: {
        type: Number,
        default: 0,
      },
      sharesNo: {
        type: Number,
        default: 0,
      },
      // Cost function value (for LMSR calculations)
      costFunction: {
        type: Number,
        default: 0,
      },
    },
    resolution: {
      outcome: {
        type: Boolean,
      },
      resolvedAt: Date,
      notes: String,
    },
    probabilityHistory: [probabilityHistorySchema],
    tags: [String],
  },
  {
    timestamps: true,
  },
)

// Add probability to history when it changes
marketSchema.pre("save", function (next) {
  if (this.isModified("currentProbability")) {
    this.probabilityHistory.push({
      date: new Date(),
      probability: this.currentProbability,
    })
  }
  next()
})

// Index for efficient queries
marketSchema.index({ status: 1, deadline: 1 })
marketSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Market", marketSchema)
