const mongoose = require("mongoose");

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
  { _id: false }
);

const volumeHistorySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    yesVolume: {
      type: Number,
      default: 0,
    },
    noVolume: {
      type: Number,
      default: 0,
    },
    yesPercentage: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    noPercentage: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

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
    yesVolume: {
      type: Number,
      default: 0,
    },
    noVolume: {
      type: Number,
      default: 0,
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    fixedYesPrice: {
      type: Number,
      default: 0.5, // 50% probability as decimal
      min: 0.01,
      max: 0.99,
    },
    fixedNoPrice: {
      type: Number,
      default: 0.5, // 50% probability as decimal
      min: 0.01,
      max: 0.99,
    },
    lmsr: {
      beta: {
        type: Number,
        default: 100,
      },
      sharesYes: {
        type: Number,
        default: 0,
      },
      sharesNo: {
        type: Number,
        default: 0,
      },
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
    volumeHistory: [volumeHistorySchema], // New volume tracking
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Add probability to history when it changes
marketSchema.pre("save", function (next) {
  if (this.isModified("currentProbability")) {
    this.probabilityHistory.push({
      date: new Date(),
      probability: this.currentProbability,
    });
  }
  next();
});

// Add volume tracking when volume changes - FIXED VERSION
marketSchema.pre("save", function (next) {
  if (this.isModified("yesVolume") || this.isModified("noVolume")) {
    const totalVol = (this.yesVolume || 0) + (this.noVolume || 0);
    const yesPercentage =
      totalVol > 0 ? Math.round(((this.yesVolume || 0) / totalVol) * 100) : 50;
    const noPercentage =
      totalVol > 0 ? Math.round(((this.noVolume || 0) / totalVol) * 100) : 50;

    console.log(
      `📊 Market pre-save volume update - YES: ${this.yesVolume}, NO: ${this.noVolume}, Total: ${totalVol}`
    );
    console.log(
      `📊 Calculated percentages - YES: ${yesPercentage}%, NO: ${noPercentage}%`
    );

    // Update current probability to match volume percentage
    this.currentProbability = yesPercentage;

    // Only add to history if this is a real change (not just initialization)
    if (totalVol > 0) {
      this.volumeHistory.push({
        date: new Date(),
        yesVolume: this.yesVolume || 0,
        noVolume: this.noVolume || 0,
        yesPercentage,
        noPercentage,
      });

      // Also update probability history to match
      this.probabilityHistory.push({
        date: new Date(),
        probability: yesPercentage,
      });
    }
  }
  next();
});

// Index for efficient queries
marketSchema.index({ status: 1, deadline: 1 });
marketSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Market", marketSchema);
