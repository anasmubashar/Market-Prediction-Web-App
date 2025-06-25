// start-imap.js
require("dotenv").config();
const mongoose = require("mongoose");
const imapService = require("./services/imapService");

// 1) Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("🔗 MongoDB connected (IMAP worker)");
    // 2) Once DB is up, kick off IMAP listener
    imapService.startImapListener();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error (IMAP worker):", err);
    process.exit(1);
  });
