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
  static async generateProbabilityChartBuffer(market) {
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
      return null;
    }
  }

  // Bar chart for static probability
  static async generateSimpleChartBuffer(
    probability,
    title = "Market Probability"
  ) {
    const config = {
      type: "bar",
      data: {
        labels: ["Probability"],
        datasets: [
          {
            label: "Current Probability",
            data: [probability],
            backgroundColor: "rgba(54, 162, 235, 0.6)",
          },
        ],
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 20 } },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 18, family: "'DejaVu Sans', sans-serif" },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // Line chart for historical probabilities
  static async generateLineChartBuffer(history, title) {
    const labels = history.map((point) =>
      new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
    const dataPoints = history.map((point) => point.probability);

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Probability Over Time",
            data: dataPoints,
            fill: false,
            borderColor: "rgb(75, 192, 192)",
            tension: 0.3,
          },
        ],
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 20 } },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 18, family: "'DejaVu Sans', sans-serif" },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }
}

module.exports = ChartService;
