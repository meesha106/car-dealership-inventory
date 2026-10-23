import argon2 from "argon2";

export interface AdminSeedDatabase {
  query(
    sql: string,
    values: unknown[],
  ): Promise<{ rows: Array<{ id: string }> }>;
}

export async function seedInitialAdmin(
  database: AdminSeedDatabase,
  email: string,
  password: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);
  const result = await database.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id`,
    [normalizedEmail, passwordHash, "ADMIN"],
  );
  const admin = result.rows[0];

  if (!admin) {
    throw new Error("Admin seed did not return a user record");
  }

  return admin.id;
}
