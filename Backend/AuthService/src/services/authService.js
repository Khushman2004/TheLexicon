import { randomBytes } from "node:crypto";
import { User } from "../models/userModel.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.sessions = new Map();
  }

  async register({ username, email, password, fullName, bio, avatarUrl }) {
    if (await this.userRepository.findByEmail(email)) {
      return { error: "An account with this email already exists.", status: 409 };
    }

    if (await this.userRepository.findByUsername(username)) {
      return { error: "That username is already taken.", status: 409 };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      fullName: fullName?.trim() || null,
      bio: bio?.trim() || null,
      avatarUrl: avatarUrl?.trim() || null,
    });

    if (!(await this.userRepository.create(user))) {
      return { error: "That username or email is already in use.", status: 409 };
    }

    return { user: user.toPublicJSON(), token: this.#createSession(user.id) };
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "Email or password is incorrect.", status: 401 };
    }

    return { user: user.toPublicJSON(), token: this.#createSession(user.id) };
  }

  async getUserForToken(token) {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }

    const user = await this.userRepository.findById(session.userId);
    return user?.toPublicJSON() ?? null;
  }

  logout(token) {
    return this.sessions.delete(token);
  }

  #createSession(userId) {
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }
}
