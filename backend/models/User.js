const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // name: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },
    points: {
      type: Number,
      default: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      marketUpdates: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalPredictions: {
        type: Number,
        default: 0,
      },
      correctPredictions: {
        type: Number,
        default: 0,
      },
      accuracy: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Update accuracy when stats change
userSchema.pre("save", function (next) {
  if (this.stats.totalPredictions > 0) {
    this.stats.accuracy = Math.round(
      (this.stats.correctPredictions / this.stats.totalPredictions) * 100
    );
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
