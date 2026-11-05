import express from "express";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { HttpError } from "./controllers/authController.js";

export function createApp(authService) {
  const app = express();

  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_request, response) => {
    response.json({ service: "auth", status: "ok" });
  });

  app.use("/api/auth", createAuthRoutes(authService));

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Endpoint not found."));
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }

    if (error.type === "entity.too.large") {
      response.status(413).json({ error: "Request body is too large." });
      return;
    }

    console.error("Authentication service request failed:", error);
    response.status(500).json({ error: "Internal server error." });
  });

  return app;
}
