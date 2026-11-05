export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const { username, email, password, fullName, bio, avatarUrl } = body;
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,32}$/.test(username.trim())) {
    throw new HttpError(400, "Username must be 3-32 characters (letters, numbers, underscores).");
  }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new HttpError(400, "A valid email is required.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new HttpError(400, "Password must be between 8 and 128 characters.");
  }
  for (const [field, value, maxLength] of [
    ["fullName", fullName, 100],
    ["bio", bio, 500],
    ["avatarUrl", avatarUrl, 2048],
  ]) {
    if (value !== undefined && value !== null && (typeof value !== "string" || value.length > maxLength)) {
      throw new HttpError(400, `${field} must be a string of at most ${maxLength} characters.`);
    }
  }

  return { username, email, password, fullName, bio, avatarUrl };
}

export function validateLogin(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const { email, password } = body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    throw new HttpError(400, "Email and password are required.");
  }

  return { email, password };
}
