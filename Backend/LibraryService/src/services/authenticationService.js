import { HttpError } from "../utils/httpError.js";

export class AuthenticationService {
  constructor(authenticationRepository) {
    this.authenticationRepository = authenticationRepository;
  }

  async getUserForRequest(request) {
    const authorization = request.headers.authorization;
    const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new HttpError(401, "A valid bearer token is required.");

    const userId = await this.authenticationRepository.findUserIdForToken(match[1]);
    if (!userId) throw new HttpError(401, "A valid bearer token is required.");
    return { id: userId };
  }
}
