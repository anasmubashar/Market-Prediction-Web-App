const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const { registerFont } = require("canvas");
const path = require("path");

registerFont(path.join(__dirname, "../assets/fonts/DejaVuSans.ttf"), {
  family: "DejaVu Sans",
});

class ChartService {
  static width = 600;
  static height = 300;

  static chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: this.width,
    height: this.height,
    backgroundColour: "white",
  });

  // Entry point: returns buffer
  // Updated to match the emailService call signature
  static async generateProbabilityChartBuffer(market, marketId = null) {
    try {
      const history = market.probabilityHistory || [];

      if (history.length === 0) {
        return await this.generateSimpleChartBuffer(
          market.currentProbability,
          market.title
        );
      }

      return await this.generateLineChartBuffer(history, market.title);
    } catch (error) {
      console.error("Error generating chart buffer:", error);
      // Return a fallback chart instead of null
      return await this.generateErrorChartBuffer(market.title);
    }
  }

  // Bar chart for static probability (enhanced for fixed-odds)
  static async generateSimpleChartBuffer(
    probability,
    title = "Market Probability"
  ) {
    const config = {
      type: "bar",
      data: {
        labels: ["YES", "NO"],
        datasets: [
          {
            label: "Probability (%)",
            data: [probability, 100 - probability],
            backgroundColor: [
              "rgba(34, 197, 94, 0.6)",
              "rgba(239, 68, 68, 0.6)",
            ],
            borderColor: ["rgba(34, 197, 94, 1)", "rgba(239, 68, 68, 1)"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + "%",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16, family: "'DejaVu Sans', sans-serif" },
          },
          legend: {
            display: false,
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // Line chart for historical probabilities (enhanced)
  static async generateLineChartBuffer(history, title) {
    // Limit to last 30 data points for readability
    const recentHistory = history.slice(-30);

    const labels = recentHistory.map((point) =>
      new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      })
    );

    const dataPoints = recentHistory.map((point) => point.probability);

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "YES Probability (%)",
            data: dataPoints,
            fill: true,
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            borderColor: "rgba(34, 197, 94, 1)",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + "%",
            },
          },
          x: {
            ticks: {
              maxTicksLimit: 8, // Limit number of x-axis labels
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16, family: "'DejaVu Sans', sans-serif" },
          },
          legend: {
            display: true,
            position: "bottom",
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // New: Error fallback chart
  static async generateErrorChartBuffer(title = "Market Chart") {
    const config = {
      type: "bar",
      data: {
        labels: ["Chart Error"],
        datasets: [
          {
            label: "Error",
            data: [0],
            backgroundColor: "rgba(239, 68, 68, 0.6)",
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          y: { min: 0, max: 100 },
        },
        plugins: {
          title: {
            display: true,
            text: `${title} - Chart Error`,
            font: { size: 16, family: "'DejaVu Sans', sans-serif" },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // New: Generate fixed-odds pricing chart
  static async generateFixedOddsPricingChart(market) {
    try {
      const yesPrice = (market.fixedYesPrice * 100).toFixed(1);
      const noPrice = (market.fixedNoPrice * 100).toFixed(1);

      const config = {
        type: "doughnut",
        data: {
          labels: [`YES (${yesPrice}¢)`, `NO (${noPrice}¢)`],
          datasets: [
            {
              data: [market.fixedYesPrice * 100, market.fixedNoPrice * 100],
              backgroundColor: [
                "rgba(34, 197, 94, 0.8)",
                "rgba(239, 68, 68, 0.8)",
              ],
              borderColor: ["rgba(34, 197, 94, 1)", "rgba(239, 68, 68, 1)"],
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: false,
          plugins: {
            title: {
              display: true,
              text: `${market.title} - Fixed Odds Pricing`,
              font: { size: 16, family: "'DejaVu Sans', sans-serif" },
            },
            legend: {
              display: true,
              position: "bottom",
            },
          },
        },
      };

      return await this.chartJSNodeCanvas.renderToBuffer(config);
    } catch (error) {
      console.error("Error generating fixed-odds pricing chart:", error);
      return await this.generateErrorChartBuffer(market.title);
    }
  }

  // New: Generate market volume chart
  static async generateVolumeChart(market, transactions = []) {
    try {
      if (transactions.length === 0) {
        return await this.generateSimpleVolumeChart(
          market.totalVolume,
          market.title
        );
      }

      // Group transactions by day
      const dailyVolume = {};
      transactions.forEach((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        dailyVolume[date] =
          (dailyVolume[date] || 0) + Math.abs(tx.pointsChange);
      });

      const labels = Object.keys(dailyVolume).slice(-14); // Last 14 days
      const data = labels.map((date) => dailyVolume[date]);

      const config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Daily Volume (Points)",
              data,
              backgroundColor: "rgba(99, 102, 241, 0.6)",
              borderColor: "rgba(99, 102, 241, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => value + " pts",
              },
            },
          },
          plugins: {
            title: {
              display: true,
              text: `${market.title} - Trading Volume`,
              font: { size: 16, family: "'DejaVu Sans', sans-serif" },
            },
          },
        },
      };

      return await this.chartJSNodeCanvas.renderToBuffer(config);
    } catch (error) {
      console.error("Error generating volume chart:", error);
      return await this.generateErrorChartBuffer(market.title);
    }
  }

  // Simple volume chart for markets with no transaction history
  static async generateSimpleVolumeChart(totalVolume, title) {
    const config = {
      type: "bar",
      data: {
        labels: ["Total Volume"],
        datasets: [
          {
            label: "Volume (Points)",
            data: [totalVolume],
            backgroundColor: "rgba(99, 102, 241, 0.6)",
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => value + " pts",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `${title} - Total Volume`,
            font: { size: 16, family: "'DejaVu Sans', sans-serif" },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }
}

module.exports = ChartService;
