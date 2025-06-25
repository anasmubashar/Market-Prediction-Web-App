const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
require("./scheduler");

const app = express();

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const marketRoutes = require("./routes/markets");
const transactionRoutes = require("./routes/transactions");
const emailRoutes = require("./routes/emails");
const adminRoutes = require("./routes/admin");

// Import services
const emailService = require("./services/emailService");
const imapService = require("./services/imapService");

const allowedOrigins = [process.env.FRONTEND_URL_1, process.env.FRONTEND_URL_2];

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
app.use(cors("*"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Runtime lock to avoid accidental double starts
if (process.env.ENABLE_IMAP === "true" && !global.__IMAP_STARTED__) {
  global.__IMAP_STARTED__ = true;
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Connected to MongoDB");
      // Start IMAP service after DB connection
      imapService.startImapListener();
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error);
      process.exit(1);
    });
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "production" ? {} : err.stack,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
