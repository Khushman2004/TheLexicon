import express from "express";
import { ENDPOINTS } from "./config/endpoints.js";
import { cors } from "./middleware/cors.js";
import { createNetworkRoutes } from "./routes/networkRoutes.js";
import { HttpError } from "./utils/httpError.js";

export function createApp(authenticationService, networkService) {
  const app = express();
  app.use(cors);
  app.use(express.json({ limit: "10kb" }));
  app.get(ENDPOINTS.HEALTH, (_request, response) => {
    response.json({ service: "network", status: "ok" });
  });
  app.use(ENDPOINTS.API, createNetworkRoutes(authenticationService, networkService));
  app.use((_request, _response, next) => next(new HttpError(404, "Endpoint not found.")));
  app.use((error, request, response, _next) => {
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
    console.error(`Network service request failed [${request.method} ${request.originalUrl}]:`, error);
    response.status(500).json({ error: "Internal server error." });
  });
  return app;
}
