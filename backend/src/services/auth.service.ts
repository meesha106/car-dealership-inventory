import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createDatabasePool } from "../db/pool.js";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";

export type UserRole = "USER" | "ADMIN";

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

interface UserRecord extends PublicUser {
  password_hash: string;
}

const database = createDatabasePool(
  process.env.NODE_ENV === "test" ? "test" : "development",
);

export async function registerUser(
  email: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);
  const result = await database.query<PublicUser>(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'USER')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, role`,
    [normalizedEmail, passwordHash],
  );
  const user = result.rows[0];

  if (!user) {
    throw new HttpError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists.",
    );
  }

  return { user, token: createToken(user) };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await database.query<UserRecord>(
    `SELECT id, email, role, password_hash
     FROM users
     WHERE email = $1`,
    [normalizedEmail],
  );
  const user = result.rows[0];

  if (!user || !(await argon2.verify(user.password_hash, password))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  return { user: publicUser, token: createToken(publicUser) };
}

function createToken(user: PublicUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "1h",
  });
}
