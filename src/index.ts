import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { apiRateLimit } from "./middleware/rateLimit";
import { router as apiRouter } from "./routes";
import { startSchedulerLoop } from "./services/scheduler/loop";
import { startWeeklyLearningLoop } from "./services/growth/learnLoop";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use("/api", apiRateLimit);

app.get("/health", (_req, res) => res.json({ status: "ok", t: Date.now() }));
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Postly backend up");
  startSchedulerLoop();
  startWeeklyLearningLoop();
});

const shutdown = (sig: string) => {
  logger.info({ sig }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
