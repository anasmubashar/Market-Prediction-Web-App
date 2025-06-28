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

  const price = side === "YES" ? market.fixedYesPrice : market.fixedNoPrice;
  const shares = Math.floor((amount / price) * 100) / 100; // round to 2 decimals
  const cost = Math.ceil(price * shares * 100) / 100;

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
  }

  if (side === "YES") position.sharesYes += shares;
  else position.sharesNo += shares;

  await position.save();

  market.totalVolume += cost;

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
  };
}

/**
 * Calculate shares that can be bought with given budget
 * @param {number} budget - Points to spend
 * @param {number} price - Price per share (0-1)
 * @returns {object} - Calculation result
 */
function calculateSharesForBudget(budget, price) {
  const shares = Math.floor((budget / price) * 100) / 100;
  const cost = Math.ceil(price * shares * 100) / 100;

  return {
    shares,
    cost,
    newPrice: price, // Fixed odds don't change
  };
}

/**
 * Get market statistics
 * @param {object} market - Market object
 * @returns {object} - Market stats
 */
function getMarketStats(market) {
  return {
    yesPrice: market.fixedYesPrice,
    noPrice: market.fixedNoPrice,
    yesProbability: Math.round(market.fixedYesPrice * 100),
    noProbability: Math.round(market.fixedNoPrice * 100),
    totalVolume: market.totalVolume,
    participantCount: market.participantCount,
  };
}

module.exports = {
  buyFixedShares,
  calculateSharesForBudget,
  getMarketStats,
};
