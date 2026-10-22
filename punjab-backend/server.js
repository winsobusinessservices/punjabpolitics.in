const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

dotenv.config();

if (process.env.NODE_ENV !== "production") {
  const developmentDefaults = {
    PORT: "8012",
    SITE_SLUG: "punjab-politics",
    CLIENT_ORIGIN: "http://localhost:3012",
    PANEL_ORIGIN: "http://localhost:3013",
    API_PUBLIC_URL: "http://localhost:8012",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "root",
    DB_PASSWORD: "",
    DB_NAME: "punjabpolitics",
    JWT_SECRET: "punjab-politics-local-development-only",
  };
  for (const [key, value] of Object.entries(developmentDefaults)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  // Local development may reuse the existing public Google Web Client ID.
  // Production remains independent and must provide GOOGLE_CLIENT_ID itself.
  if (!process.env.GOOGLE_CLIENT_ID) {
    const parentEnvironmentPath = path.resolve(__dirname, "../indian-rajniti-backend/.env");
    if (fs.existsSync(parentEnvironmentPath)) {
      const parentEnvironment = dotenv.parse(fs.readFileSync(parentEnvironmentPath));
      if (parentEnvironment.GOOGLE_CLIENT_ID) {
        process.env.GOOGLE_CLIENT_ID = parentEnvironment.GOOGLE_CLIENT_ID;
      }
    }
  }
}

const pool = require("./src/config/db");


const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");
const PORT = process.env.PORT || 8012;
const authRoutes = require("./src/routes/auth.routes.js")
const contentRoutes = require("./src/routes/content.routes.js")
const applicationRoutes = require("./src/routes/applications.routes.js")
const newsRoutes = require("./src/routes/news.routes.js")
const politiciansRoutes = require("./src/routes/politicians.routes.js")
const careersRoutes = require("./src/routes/careers.routes.js")
const categoriesRoutes = require("./src/routes/categories.routes.js")
const contactRoutes = require("./src/routes/contact.routes.js")
const referenceDataRoutes = require("./src/routes/referenceData.routes.js")
const walletRoutes = require("./src/routes/wallet.routes.js")
const policiesRoutes = require("./src/routes/policies.routes.js")
const commentsRoutes = require("./src/routes/comments.routes.js")
const contentLimitsRoutes = require("./src/routes/contentLimits.routes.js")
const deletionsRoutes = require("./src/routes/deletions.routes.js")
const sitesRoutes = require("./src/routes/sites.routes.js")
const servicesRoutes = require("./src/routes/services.routes.js")
const adsRoutes = require("./src/routes/ads.routes.js")
const anaylticsRoutes = require("./src/routes/analytics.routes.js")
const taskRoutes = require("./src/routes/task.routes.js")
const internalLinksRoutes = require("./src/routes/internalLinks.routes.js")
const { resolveSite } = require("./src/middleware/site.middleware.js");
const Site = require("./src/models/site.model.js");
const { publishDueScheduledContent } = require("./src/services/scheduledPublishing.service.js");
const { sendError } = require("./src/utils/httpError.js");
const subscriptionRoutes = require("./src/routes/subscription.routes.js");
const supportRoutes = require("./src/routes/support.routes.js");
const preferencesRoutes = require("./src/routes/preferences.routes.js");
const historyRoutes = require("./src/routes/history.routes.js");
const pushRoutes = require("./src/routes/pushRoutes.js");
const { startInterestPushScheduler } = require("./src/services/interestPush.service.js");


const REQUIRED_PRODUCTION_ENV = ["CLIENT_ORIGIN", "JWT_SECRET", "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingProductionEnv = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]);
if (process.env.NODE_ENV === "production" && missingProductionEnv.length) {
  throw new Error(`Missing required production environment variables: ${missingProductionEnv.join(", ")}`);
}

const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || "",
  process.env.PANEL_ORIGIN || "https://panel.punjabpolitics.com",
  process.env.API_PUBLIC_URL || "",
  "http://localhost:3012",
  "http://127.0.0.1:3012",
  "http://localhost:3013",
  "http://127.0.0.1:3013",
  "https://punjabpolitics.com",
  "https://www.punjabpolitics.com",
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]
  .flatMap((value) => value.split(","))
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean));

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.use(
  cors({
    origin: async (origin, callback) => {
      // Allow server-to-server requests / health checks
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      try {
        const originUrl = new URL(normalizedOrigin);
        if (process.env.NODE_ENV !== "production" && originUrl.hostname.endsWith(".localhost")) {
          return callback(null, true);
        }
        const configuredSite = await Site.findByDomain(originUrl.hostname);
        if (configuredSite) return callback(null, true);
      } catch (error) {
        console.error("CORS website lookup failed:", error.message);
      }

      console.error(`CORS blocked origin: ${origin}`);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Site-Slug", "X-Site-Domain", "X-Management-Site-Id"],
  })
);
app.use(compression());
// rawBody is kept for the payment webhook, whose signature is computed over the exact bytes sent.
app.use(express.json({ verify: (req, res, buf) => { if (req.originalUrl.startsWith("/api/subscription/webhook") || req.originalUrl.startsWith("/api/payments/webhook")) req.rawBody = buf; } }));
app.use(cookieParser());
app.use(resolveSite);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    etag: true,
    immutable: true,
    maxAge: "1y",
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", authRoutes)
app.use("/api", contentRoutes)
app.use("/api", applicationRoutes)
app.use("/api", newsRoutes)
app.use("/api", politiciansRoutes)
app.use("/api", careersRoutes)
app.use("/api", categoriesRoutes)
app.use("/api", contactRoutes)
app.use("/api", referenceDataRoutes)
app.use("/api", walletRoutes)
app.use("/api", policiesRoutes)
app.use("/api", commentsRoutes)
app.use("/api", contentLimitsRoutes)
app.use("/api", deletionsRoutes)
app.use("/api", sitesRoutes)
app.use("/api", servicesRoutes)
app.use("/api", adsRoutes)
app.use("/api", anaylticsRoutes)
app.use("/api", taskRoutes)
app.use("/api", internalLinksRoutes)
app.use("/api", subscriptionRoutes);
app.use("/api", supportRoutes);
app.use("/api", preferencesRoutes);
app.use("/api", historyRoutes);
app.use("/api", pushRoutes);


app.get("/", (req, res) => {
  res.send("API is running...");
});
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ success: true, status: "healthy" });
  } catch {
    return res.status(503).json({ success: false, status: "unhealthy" });
  }
});

// Surfaces multer errors (bad file type, file too large) as JSON instead of
// Express's default HTML error page, which the frontend can't parse.
app.use((err, req, res, next) => {
  if (err?.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ success: false, message: err.message });
  }
  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && err?.status === 400)) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON body. Remove trailing commas and check the request syntax.",
    });
  }
  if (err && err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message;
    return res.status(400).json({ success: false, message });
  }
  if (err && /^Unsupported file type/.test(err.message || "")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(`[${res.locals.requestId}]`, err);
  return sendError(res, err, "The server could not complete this request. Please try again.");
});

async function startServer() {
  await pool.verifyConnection();
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  publishDueScheduledContent().catch((error) => console.error("Scheduled publishing error:", error));
  const scheduledPublishingTimer = setInterval(() => {
    publishDueScheduledContent().catch((error) => console.error("Scheduled publishing error:", error));
  }, 30_000);
  scheduledPublishingTimer.unref();
  // Interest-based notifications: checks for new items every few minutes and sends from the configured hour.
  const interestPushTimer = startInterestPushScheduler();

  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down gracefully.`);
    clearInterval(scheduledPublishingTimer);
    if (interestPushTimer) clearInterval(interestPushTimer);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
