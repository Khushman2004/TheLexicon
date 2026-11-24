import { HttpError } from "../utils/httpError.js";

export class AuthenticationService {
  constructor(repository) {
    this.repository = repository;
  }

  async getUserForRequest(request) {
    const authorization = request.headers.authorization;
    const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new HttpError(401, "A valid bearer token is required.");
    const id = await this.repository.findUserIdForToken(match[1]);
    if (!id) throw new HttpError(401, "A valid bearer token is required.");
    return { id };
  }
}
