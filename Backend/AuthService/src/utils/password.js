import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_BYTES);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hashHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hashHex || hashHex.length !== KEY_BYTES * 2) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt, KEY_BYTES);
  return timingSafeEqual(expected, actual);
}
