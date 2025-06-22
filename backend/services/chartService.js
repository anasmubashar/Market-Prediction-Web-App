/**
 * Chart Service - Text-based charts for email compatibility
 * This version creates ASCII charts instead of PNG images
 */

class ChartService {
  /**
   * Generate a text-based probability chart for email
   * @param {Object} market - Market object with probability history
   * @param {string} userEmail - User email for logging
   * @returns {string} - ASCII chart as text
   */
  static async generateProbabilityChart(market, userEmail = "default") {
    try {
      const history = market.probabilityHistory || [];

      if (history.length === 0) {
        return this.createSimpleChart(market.currentProbability);
      }

      return this.createASCIIChart(history, market.title);
    } catch (error) {
      console.error("Error generating chart:", error);
      return this.createSimpleChart(market.currentProbability);
    }
  }

  /**
   * Create a simple text chart for single probability
   */
  static createSimpleChart(probability) {
    const barLength = 50;
    const filledLength = Math.round((probability / 100) * barLength);
    const emptyLength = barLength - filledLength;

    const bar = "█".repeat(filledLength) + "░".repeat(emptyLength);

    return `
📊 MARKET PROBABILITY: ${probability}%

0%    25%    50%    75%    100%
|      |      |      |      |
${bar}

Current Probability: ${probability}%
    `;
  }

  /**
   * Create ASCII chart from probability history
   */
  static createASCIIChart(history, title) {
    const maxPoints = Math.min(history.length, 10); // Show last 10 points
    const recentHistory = history.slice(-maxPoints);

    const chartHeight = 10;
    const chartWidth = 50;

    let chart = `\n📊 ${title}\n\n`;

    // Create chart grid
    for (let row = chartHeight; row >= 0; row--) {
      const percentage = (row / chartHeight) * 100;
      let line = `${percentage.toFixed(0).padStart(3)}% |`;

      for (let col = 0; col < recentHistory.length; col++) {
        const point = recentHistory[col];
        const normalizedValue = (point.probability / 100) * chartHeight;

        if (Math.round(normalizedValue) === row) {
          line += " ●";
        } else if (Math.round(normalizedValue) > row) {
          line += " |";
        } else {
          line += "  ";
        }
      }

      chart += line + "\n";
    }

    // Add bottom axis
    chart += "    +";
    for (let i = 0; i < recentHistory.length; i++) {
      chart += "--";
    }
    chart += "\n     ";

    // Add dates
    recentHistory.forEach((point, index) => {
      if (index % 2 === 0) {
        // Show every other date to avoid crowding
        const date = new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        chart += date.padEnd(4);
      }
    });

    chart += `\n\nCurrent: ${
      recentHistory[recentHistory.length - 1]?.probability || 50
    }%`;
    chart += `\nTrend: ${this.calculateTrend(recentHistory)}`;

    return chart;
  }

  /**
   * Calculate trend direction
   */
  static calculateTrend(history) {
    if (history.length < 2) return "Stable";

    const first = history[0].probability;
    const last = history[history.length - 1].probability;
    const change = last - first;

    if (change > 5) return "📈 Rising";
    if (change < -5) return "📉 Falling";
    return "➡️ Stable";
  }

  /**
   * Clean up old chart files (no-op for text charts)
   */
  static cleanupOldCharts() {
    // No cleanup needed for text charts
    console.log("Text charts - no cleanup needed");
  }
}

module.exports = ChartService;
