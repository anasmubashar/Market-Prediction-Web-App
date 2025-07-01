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

  let position = await Position.findOne({ user: userId, market: marketId });
  if (!position) {
    position = new Position({
      user: userId,
      market: marketId,
      sharesYes: 0,
      sharesNo: 0,
    });

    // Increase participant count for new users only
    market.participantCount = (market.participantCount || 0) + 1;
  }

  if (side === "YES") position.sharesYes += shares;
  else position.sharesNo += shares;

  await position.save();

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

  // Track probability history
  const currentProbability = Math.round(market.fixedYesPrice * 100);
  if (!market.probabilityHistory) market.probabilityHistory = [];
  market.probabilityHistory.push({
    date: new Date(),
    probability: currentProbability,
  });

  await market.save();

  return {
    shares,
    cost,
    side,
    newBalance: user.points,
    probability: currentProbability,
    volumeStats: getVolumeStats(market),
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
 * Get volume statistics
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

  const yesPercentage = Math.round((yesVolume / totalVolume) * 100);
  const noPercentage = Math.round((noVolume / totalVolume) * 100);

  return {
    yesVolume,
    noVolume,
    yesPercentage,
    noPercentage,
    totalVolume,
  };
}

/**
 * Get market statistics
 * @param {object} market - Market object
 * @returns {object} - Market stats
 */
function getMarketStats(market) {
  const volumeStats = getVolumeStats(market);

  return {
    yesPrice: market.fixedYesPrice,
    noPrice: market.fixedNoPrice,
    yesProbability: Math.round(market.fixedYesPrice * 100),
    noProbability: Math.round(market.fixedNoPrice * 100),
    totalVolume: market.totalVolume,
    participantCount: market.participantCount,
    volumeStats,
  };
}

module.exports = {
  buyFixedShares,
  calculateSharesForBudget,
  getMarketStats,
  getVolumeStats,
};
