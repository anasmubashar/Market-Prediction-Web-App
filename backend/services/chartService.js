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

  // Main entry point: returns volume percentage line chart matching the design
  static async generateProbabilityChartBuffer(market, marketId = null) {
    try {
      const volumeHistory = market.volumeHistory || [];

      if (volumeHistory.length === 0) {
        // If no volume history, show current volume or flat line
        const yesVolume = market.yesVolume || 0;
        const noVolume = market.noVolume || 0;
        const totalVolume = yesVolume + noVolume;

        if (totalVolume === 0) {
          return await this.generateNoVolumeChart(market.title);
        }

        const yesPercentage = Math.round((yesVolume / totalVolume) * 100);
        return await this.generateSinglePointChart(yesPercentage, market.title);
      }

      return await this.generateVolumeLineChart(volumeHistory, market.title);
    } catch (error) {
      console.error("Error generating chart buffer:", error);
      return await this.generateErrorChartBuffer(market.title);
    }
  }

  // Volume percentage line chart matching the exact design
  static async generateVolumeLineChart(volumeHistory, title) {
    // Limit to last 20 data points for readability
    const recentHistory = volumeHistory.slice(-20);

    const labels = recentHistory.map((point) => {
      const date = new Date(point.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    });

    const yesData = recentHistory.map((point) => point.yesPercentage);

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "YES Probability (%)",
            data: yesData,
            fill: true,
            backgroundColor: "rgba(34, 197, 94, 0.2)", // Light green fill
            borderColor: "rgba(34, 197, 94, 1)", // Green line
            borderWidth: 2,
            tension: 0.1, // Slight curve
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "rgba(34, 197, 94, 1)",
            pointBorderColor: "rgba(34, 197, 94, 1)",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + "%",
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
          x: {
            ticks: {
              maxTicksLimit: 6,
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 14,
              family: "'DejaVu Sans', sans-serif",
              weight: "normal",
            },
            color: "#666",
            padding: {
              bottom: 20,
            },
          },
          legend: {
            display: true,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "rect",
              font: {
                size: 12,
              },
              color: "#666",
              padding: 15,
            },
          },
        },
        elements: {
          point: {
            hoverRadius: 6,
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // Single point chart when there's only one data point
  static async generateSinglePointChart(yesPercentage, title) {
    const config = {
      type: "line",
      data: {
        labels: ["Current"],
        datasets: [
          {
            label: "YES Probability (%)",
            data: [yesPercentage],
            fill: true,
            backgroundColor: "rgba(34, 197, 94, 0.2)",
            borderColor: "rgba(34, 197, 94, 1)",
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: "rgba(34, 197, 94, 1)",
            pointBorderColor: "rgba(34, 197, 94, 1)",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + "%",
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
          x: {
            ticks: {
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `${title} (${yesPercentage}% YES Volume)`,
            font: {
              size: 14,
              family: "'DejaVu Sans', sans-serif",
              weight: "normal",
            },
            color: "#666",
            padding: {
              bottom: 20,
            },
          },
          legend: {
            display: true,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "rect",
              font: {
                size: 12,
              },
              color: "#666",
              padding: 15,
            },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // No volume chart (when no trades have been made) - flat line at 50%
  static async generateNoVolumeChart(title) {
    // Generate 4 time points for a flat line
    const now = new Date();
    const labels = [];
    const data = [];

    for (let i = 3; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000); // 1 hour intervals
      labels.push(
        time.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      data.push(50); // Flat at 50%
    }

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "YES Probability (%)",
            data,
            fill: true,
            backgroundColor: "rgba(156, 163, 175, 0.2)", // Gray fill
            borderColor: "rgba(156, 163, 175, 1)", // Gray line
            borderWidth: 2,
            borderDash: [5, 5], // Dashed line to indicate no real data
            tension: 0,
            pointRadius: 4,
            pointBackgroundColor: "rgba(156, 163, 175, 1)",
            pointBorderColor: "rgba(156, 163, 175, 1)",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + "%",
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
          x: {
            ticks: {
              font: {
                size: 11,
                color: "#666",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            border: {
              color: "rgba(0, 0, 0, 0.2)",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 14,
              family: "'DejaVu Sans', sans-serif",
              weight: "normal",
            },
            color: "#666",
            padding: {
              bottom: 20,
            },
          },
          legend: {
            display: true,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "rect",
              font: {
                size: 12,
              },
              color: "#666",
              padding: 15,
            },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }

  // Error fallback chart
  static async generateErrorChartBuffer(title = "Market Chart") {
    const config = {
      type: "line",
      data: {
        labels: ["Error"],
        datasets: [
          {
            label: "Error",
            data: [0],
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderColor: "rgba(239, 68, 68, 1)",
            borderWidth: 2,
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
            font: { size: 14, family: "'DejaVu Sans', sans-serif" },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(config);
  }
}

module.exports = ChartService;
