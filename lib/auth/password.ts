import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function validateCredentials(email: string, password: string, name?: string) {
  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }
  if (name !== undefined && !name.trim()) {
    return { ok: false as const, error: "Enter your name." };
  }
  return { ok: true as const, email: trimmedEmail, password, name: name?.trim() ?? "" };
}
