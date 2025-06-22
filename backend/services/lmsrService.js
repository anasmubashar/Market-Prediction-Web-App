/**
 * LMSR (Logarithmic Market Scoring Rule) Implementation
 *
 * LMSR is a market maker algorithm that:
 * 1. Automatically provides liquidity
 * 2. Adjusts prices based on trading volume
 * 3. Ensures prices reflect collective beliefs
 * 4. Guarantees bounded loss for the market maker
 */

class LMSRService {
  /**
   * Calculate the cost function for LMSR
   * C(q) = β * ln(e^(q_yes/β) + e^(q_no/β))
   *
   * @param {number} qYes - Quantity of YES shares
   * @param {number} qNo - Quantity of NO shares
   * @param {number} beta - Liquidity parameter
   * @returns {number} Cost function value
   */
  static calculateCostFunction(qYes, qNo, beta) {
    const expYes = Math.exp(qYes / beta)
    const expNo = Math.exp(qNo / beta)
    return beta * Math.log(expYes + expNo)
  }

  /**
   * Calculate the current price of YES shares
   * P_yes = e^(q_yes/β) / (e^(q_yes/β) + e^(q_no/β))
   *
   * @param {number} qYes - Quantity of YES shares
   * @param {number} qNo - Quantity of NO shares
   * @param {number} beta - Liquidity parameter
   * @returns {number} Price between 0 and 1
   */
  static calculateYesPrice(qYes, qNo, beta) {
    const expYes = Math.exp(qYes / beta)
    const expNo = Math.exp(qNo / beta)
    return expYes / (expYes + expNo)
  }

  /**
   * Calculate the current price of NO shares
   * P_no = e^(q_no/β) / (e^(q_yes/β) + e^(q_no/β))
   *
   * @param {number} qYes - Quantity of YES shares
   * @param {number} qNo - Quantity of NO shares
   * @param {number} beta - Liquidity parameter
   * @returns {number} Price between 0 and 1
   */
  static calculateNoPrice(qYes, qNo, beta) {
    const expYes = Math.exp(qYes / beta)
    const expNo = Math.exp(qNo / beta)
    return expNo / (expYes + expNo)
  }

  /**
   * Calculate cost to buy a certain number of shares
   * Cost = C(q + Δq) - C(q)
   *
   * @param {number} currentQYes - Current YES shares
   * @param {number} currentQNo - Current NO shares
   * @param {number} deltaQYes - Change in YES shares
   * @param {number} deltaQNo - Change in NO shares
   * @param {number} beta - Liquidity parameter
   * @returns {number} Cost of the trade
   */
  static calculateTradeCost(currentQYes, currentQNo, deltaQYes, deltaQNo, beta) {
    const currentCost = this.calculateCostFunction(currentQYes, currentQNo, beta)
    const newCost = this.calculateCostFunction(currentQYes + deltaQYes, currentQNo + deltaQNo, beta)
    return newCost - currentCost
  }

  /**
   * Calculate how many shares can be bought with a given budget
   * Uses binary search to find the maximum shares within budget
   *
   * @param {number} currentQYes - Current YES shares
   * @param {number} currentQNo - Current NO shares
   * @param {number} budget - Available points to spend
   * @param {string} shareType - "YES" or "NO"
   * @param {number} beta - Liquidity parameter
   * @returns {object} { shares, cost, newPrice }
   */
  static calculateSharesForBudget(currentQYes, currentQNo, budget, shareType, beta) {
    let low = 0
    let high = budget * 10 // Start with a high estimate
    let bestShares = 0
    let bestCost = 0

    // Binary search for maximum shares within budget
    while (high - low > 0.01) {
      const mid = (low + high) / 2

      let deltaQYes = 0
      let deltaQNo = 0

      if (shareType === "YES") {
        deltaQYes = mid
      } else {
        deltaQNo = mid
      }

      const cost = this.calculateTradeCost(currentQYes, currentQNo, deltaQYes, deltaQNo, beta)

      if (cost <= budget) {
        bestShares = mid
        bestCost = cost
        low = mid
      } else {
        high = mid
      }
    }

    // Calculate new price after trade
    const newQYes = currentQYes + (shareType === "YES" ? bestShares : 0)
    const newQNo = currentQNo + (shareType === "NO" ? bestShares : 0)
    const newPrice = this.calculateYesPrice(newQYes, newQNo, beta)

    return {
      shares: Math.floor(bestShares * 100) / 100, // Round to 2 decimal places
      cost: Math.ceil(bestCost * 100) / 100, // Round up cost
      newPrice: Math.round(newPrice * 10000) / 100, // Convert to percentage
    }
  }

  /**
   * Calculate proceeds from selling shares
   * Selling is equivalent to buying negative shares
   *
   * @param {number} currentQYes - Current YES shares
   * @param {number} currentQNo - Current NO shares
   * @param {number} sharesToSell - Number of shares to sell
   * @param {string} shareType - "YES" or "NO"
   * @param {number} beta - Liquidity parameter
   * @returns {object} { proceeds, newPrice }
   */
  static calculateSellProceeds(currentQYes, currentQNo, sharesToSell, shareType, beta) {
    let deltaQYes = 0
    let deltaQNo = 0

    if (shareType === "YES") {
      deltaQYes = -sharesToSell
    } else {
      deltaQNo = -sharesToSell
    }

    // Selling gives negative cost (positive proceeds)
    const proceeds = -this.calculateTradeCost(currentQYes, currentQNo, deltaQYes, deltaQNo, beta)

    // Calculate new price after trade
    const newQYes = currentQYes + deltaQYes
    const newQNo = currentQNo + deltaQNo
    const newPrice = this.calculateYesPrice(newQYes, newQNo, beta)

    return {
      proceeds: Math.floor(proceeds * 100) / 100, // Round down proceeds
      newPrice: Math.round(newPrice * 10000) / 100, // Convert to percentage
    }
  }

  /**
   * Initialize market with balanced liquidity
   * Sets initial shares to create a 50/50 market
   *
   * @param {number} beta - Liquidity parameter
   * @returns {object} { qYes, qNo, initialPrice }
   */
  static initializeMarket(beta = 100) {
    // Start with equal quantities for 50/50 probability
    const qYes = 0
    const qNo = 0
    const initialPrice = this.calculateYesPrice(qYes, qNo, beta)

    return {
      qYes,
      qNo,
      initialPrice: Math.round(initialPrice * 10000) / 100,
    }
  }

  /**
   * Calculate market statistics
   *
   * @param {number} qYes - Current YES shares
   * @param {number} qNo - Current NO shares
   * @param {number} beta - Liquidity parameter
   * @returns {object} Market statistics
   */
  static getMarketStats(qYes, qNo, beta) {
    const yesPrice = this.calculateYesPrice(qYes, qNo, beta)
    const noPrice = this.calculateNoPrice(qYes, qNo, beta)
    const costFunction = this.calculateCostFunction(qYes, qNo, beta)

    return {
      yesPrice: Math.round(yesPrice * 10000) / 100,
      noPrice: Math.round(noPrice * 10000) / 100,
      yesProbability: Math.round(yesPrice * 10000) / 100,
      noProbability: Math.round(noPrice * 10000) / 100,
      totalShares: qYes + qNo,
      costFunction: Math.round(costFunction * 100) / 100,
      liquidity: beta,
    }
  }
}

module.exports = LMSRService
