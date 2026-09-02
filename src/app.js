const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");

const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const dataRoutes = require("./routes/data.routes");
const storageRoutes = require("./routes/storage.routes");
const mediaRoutes = require("./routes/media.routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Usalama wa msingi wa HTTP headers
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// Health check — muhimu kwa load balancers / uptime monitors
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Routes kuu
app.use("/auth", authRoutes);
app.use("/data", dataRoutes);
app.use("/storage", storageRoutes);
app.use("/media", mediaRoutes); // HAKUNA auth kwa hii — public

// 404 kwa chochote kingine (badala ya default ya Express)
app.use(notFoundHandler);

// Error handler ya mwisho
app.use(errorHandler);

module.exports = app;
