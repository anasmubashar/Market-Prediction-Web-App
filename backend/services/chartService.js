const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs");
const path = require("path");

class ChartService {
  static width = 600;
  static height = 300;

  static chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: this.width,
    height: this.height,
    backgroundColour: "white", // optional
  });

  static cleanupOldCharts() {
    const dir = __dirname;
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      if (file.startsWith("chart-") && file.endsWith(".png")) {
        fs.unlinkSync(path.join(dir, file));
      }
    });
  }

  static async generateProbabilityChart(market, userEmail = "default") {
    try {
      const history = market.probabilityHistory || [];

      if (history.length === 0) {
        return await this.generateSimpleChartImage(
          market.currentProbability,
          market.title
        );
      }

      return await this.generateLineChartImage(
        history,
        market.title,
        userEmail
      );
    } catch (error) {
      console.error("Error generating chart:", error);
      return null;
    }
  }

  static async generateSimpleChartImage(
    probability,
    title = "Market Probability"
  ) {
    const configuration = {
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
            font: { size: 18 },
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    const filePath = path.join(__dirname, `chart-${Date.now()}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  static async generateLineChartImage(history, title, userEmail = "default") {
    this.cleanupOldCharts();
    const labels = history.map((point) =>
      new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
    const dataPoints = history.map((point) => point.probability);

    const configuration = {
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
            font: { size: 18 },
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    const filePath = path.join(
      __dirname,
      `chart-${Date.now()}-${userEmail}.png`
    );
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  static cleanupOldCharts() {
    // Optional: clean up old PNG files
    console.log("You can implement chart cleanup logic here if needed.");
  }
}

module.exports = ChartService;
