import { HttpError } from "../controllers/authController.js";

export function readBearerToken(request) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new HttpError(401, "A valid bearer token is required.");
  return match[1];
}

export async function getAuthenticatedUser(request, authService) {
  const user = await authService.getUserForToken(readBearerToken(request));
  if (!user) throw new HttpError(401, "A valid bearer token is required.");
  return user;
}
