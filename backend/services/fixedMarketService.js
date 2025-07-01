// fixedMarketService.js

const Market = require("../models/Market");
const Position = require("../models/Position");
const User = require("../models/User");

/**
 * Buy fixed-odds shares
 * @param {string} userId - User ID
 * @param {string} marketId - Market ID
 * @param {string} side - "YES" or "NO"
 * @param {number} amount - Points to spend
 * @returns {object} - Trade details
 */
async function buyFixedShares(userId, marketId, side, amount) {
  const market = await Market.findById(marketId);
  if (!market || market.status !== "active")
    throw new Error("Market not active");

  const user = await User.findById(userId);
  if (!user || user.points < amount) throw new Error("Insufficient balance");

  // Fix the price calculation - convert decimal to points
  const priceDecimal =
    side === "YES" ? market.fixedYesPrice : market.fixedNoPrice;
  const priceInPoints = priceDecimal * 100; // Convert 0.5 to 50 points
  const shares = Math.floor((amount / priceInPoints) * 100) / 100;
  const cost = Math.ceil(priceInPoints * shares * 100) / 100;

  user.points -= cost;
  await user.save();

  // Check if user already has a position in this market
  let position = await Position.findOne({ user: userId, market: marketId });
  let isNewParticipant = false;

  if (!position) {
    // This is a new participant - create position and increment count
    position = new Position({
      user: userId,
      market: marketId,
      sharesYes: 0,
      sharesNo: 0,
      totalInvested: 0,
    });
    isNewParticipant = true;
    console.log(
      `👤 New participant detected for market ${marketId}: ${user.email}`
    );
  }

  // Update position
  if (side === "YES") position.sharesYes += shares;
  else position.sharesNo += shares;

  position.totalInvested += cost;
  await position.save();

  // Update market participant count ONLY for new participants
  if (isNewParticipant) {
    market.participantCount = (market.participantCount || 0) + 1;
    console.log(
      `👤 Participant count updated: ${market.participantCount} for market "${market.title}"`
    );
  }

  // Update volume tracking by side - ensure proper initialization
  if (!market.yesVolume) market.yesVolume = 0;
  if (!market.noVolume) market.noVolume = 0;
  if (!market.totalVolume) market.totalVolume = 0;

  // Add the cost to the appropriate volume
  market.totalVolume += cost;
  if (side === "YES") {
    market.yesVolume += cost;
  } else {
    market.noVolume += cost;
  }

  console.log(
    `📊 Volume updated - YES: ${market.yesVolume}, NO: ${market.noVolume}, Total: ${market.totalVolume}`
  );

  // Calculate and update current probability based on volume
  const yesPercentage =
    market.totalVolume > 0
      ? Math.round((market.yesVolume / market.totalVolume) * 100)
      : 50;
  market.currentProbability = yesPercentage;

  // Track probability history with volume-based percentage
  if (!market.probabilityHistory) market.probabilityHistory = [];
  market.probabilityHistory.push({
    date: new Date(),
    probability: yesPercentage,
  });

  // Update volume history with correct percentages
  const noPercentage =
    market.totalVolume > 0
      ? Math.round((market.noVolume / market.totalVolume) * 100)
      : 50;

  if (!market.volumeHistory) market.volumeHistory = [];
  market.volumeHistory.push({
    date: new Date(),
    yesVolume: market.yesVolume,
    noVolume: market.noVolume,
    yesPercentage,
    noPercentage,
  });

  await market.save();

  console.log(
    `📊 Updated percentages - YES: ${yesPercentage}%, NO: ${noPercentage}%`
  );
  console.log(`👤 Final participant count: ${market.participantCount}`);

  return {
    shares,
    cost,
    side,
    newBalance: user.points,
    probability: yesPercentage,
    volumeStats: getVolumeStats(market),
    isNewParticipant, // Include this for debugging
  };
}

/**
 * Calculate shares that can be bought with given budget
 * @param {number} budget - Points to spend
 * @param {number} priceDecimal - Price per share (0-1)
 * @returns {object} - Calculation result
 */
function calculateSharesForBudget(budget, priceDecimal) {
  const priceInPoints = priceDecimal * 100; // Convert decimal to points
  const shares = Math.floor((budget / priceInPoints) * 100) / 100;
  const cost = Math.ceil(priceInPoints * shares * 100) / 100;

  return {
    shares,
    cost,
    newPrice: priceDecimal, // Keep as decimal for probability display
  };
}

/**
 * Get volume statistics - FIXED VERSION
 * @param {object} market - Market object
 * @returns {object} - Volume stats
 */
function getVolumeStats(market) {
  const yesVolume = market.yesVolume || 0;
  const noVolume = market.noVolume || 0;
  const totalVolume = yesVolume + noVolume;

  console.log(
    `📊 getVolumeStats - YES: ${yesVolume}, NO: ${noVolume}, Total: ${totalVolume}`
  );

  if (totalVolume === 0) {
    return {
      yesVolume: 0,
      noVolume: 0,
      yesPercentage: 50,
      noPercentage: 50,
      totalVolume: 0,
    };
  }

  // Use consistent rounding
  const yesPercentage = Math.round((yesVolume / totalVolume) * 100);
  const noPercentage = Math.round((noVolume / totalVolume) * 100);

  console.log(
    `📊 Calculated percentages - YES: ${yesPercentage}%, NO: ${noPercentage}%`
  );

  return {
    yesVolume,
    noVolume,
    yesPercentage,
    noPercentage,
    totalVolume,
  };
}

/**
 * Get market statistics - FIXED VERSION
 * @param {object} market - Market object
 * @returns {object} - Market stats
 */
function getMarketStats(market) {
  const volumeStats = getVolumeStats(market);

  // Calculate current probability based on volume
  const currentProbability = volumeStats.yesPercentage;

  return {
    yesPrice: market.fixedYesPrice,
    noPrice: market.fixedNoPrice,
    yesProbability: currentProbability,
    noProbability: 100 - currentProbability,
    totalVolume: market.totalVolume,
    participantCount: market.participantCount || 0, // Ensure we return a number
    volumeStats,
    currentProbability, // Add this for consistency
  };
}

/**
 * Recalculate participant count for a market (utility function for fixing existing data)
 * @param {string} marketId - Market ID
 * @returns {number} - Actual participant count
 */
async function recalculateParticipantCount(marketId) {
  try {
    const actualCount = await Position.countDocuments({ market: marketId });

    const market = await Market.findById(marketId);
    if (market) {
      market.participantCount = actualCount;
      await market.save();
      console.log(
        `🔧 Recalculated participant count for "${market.title}": ${actualCount}`
      );
    }

    return actualCount;
  } catch (error) {
    console.error("Error recalculating participant count:", error);
    return 0;
  }
}

module.exports = {
  buyFixedShares,
  calculateSharesForBudget,
  getMarketStats,
  getVolumeStats,
  recalculateParticipantCount,
};
