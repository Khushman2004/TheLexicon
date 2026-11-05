import { Router } from "express";
import {
  HttpError,
  validateLogin,
  validateRegistration,
} from "../controllers/authController.js";

export function createAuthRoutes(authService) {
  const router = Router();

  router.post("/register", async (request, response) => {
    const result = await authService.register(validateRegistration(request.body));
    if (result.error) {
      response.status(result.status).json({ error: result.error });
      return;
    }

    response.status(201).json({ user: result.user, token: result.token });
  });

  router.post("/login", async (request, response) => {
    const result = await authService.login(validateLogin(request.body));
    if (result.error) {
      response.status(result.status).json({ error: result.error });
      return;
    }

    response.json({ user: result.user, token: result.token });
  });

  router.get("/me", async (request, response) => {
    const user = await authService.getUserForToken(readBearerToken(request));
    if (!user) throw new HttpError(401, "A valid bearer token is required.");
    response.json({ user });
  });

  router.post("/logout", (request, response) => {
    if (!authService.logout(readBearerToken(request))) {
      throw new HttpError(401, "A valid bearer token is required.");
    }

    response.json({ message: "Signed out successfully." });
  });

  return router;
}

function readBearerToken(request) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === "string" && authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  if (!match) throw new HttpError(401, "A valid bearer token is required.");
  return match[1];
}
