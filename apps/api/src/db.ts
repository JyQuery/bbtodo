import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    ...timestamps
  },
  (table) => ({
    issuerSubjectIdx: uniqueIndex("users_issuer_subject_idx").on(
      table.issuer,
      table.subject
    )
  })
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull()
});

export type DatabaseClient = BetterSQLite3Database<{
  users: typeof users;
  sessions: typeof sessions;
}>;

export type UserRecord = typeof users.$inferSelect;

export interface DatabaseServices {
  database: Database.Database;
  db: DatabaseClient;
}

export function createDatabase(sqlitePath: string): DatabaseServices {
  const database = new Database(sqlitePath);
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      issuer TEXT NOT NULL,
      subject TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_issuer_subject_idx
      ON users (issuer, subject);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
  `);

  return {
    database,
    db: drizzle(database, {
      schema: {
        users,
        sessions
      }
    })
  };
}

export async function upsertUser(
  db: DatabaseClient,
  input: {
    issuer: string;
    subject: string;
    email: string | null;
    displayName: string | null;
  }
) {
  const now = new Date().toISOString();
  db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      issuer: input.issuer,
      subject: input.subject,
      email: input.email,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [users.issuer, users.subject],
      set: {
        email: input.email,
        displayName: input.displayName,
        updatedAt: now
      }
    })
    .run();

  const existing = db
    .select()
    .from(users)
    .where(and(eq(users.issuer, input.issuer), eq(users.subject, input.subject)))
    .get();

  if (!existing) {
    throw new Error("Failed to resolve user after upsert.");
  }

  return existing;
}

export function createSession(
  db: DatabaseClient,
  input: {
    userId: string;
    expiresAt: string;
  }
) {
  const session = {
    id: crypto.randomUUID(),
    userId: input.userId,
    expiresAt: input.expiresAt,
    createdAt: new Date().toISOString()
  };

  db.insert(sessions).values(session).run();

  return session;
}

export function getUserForSession(db: DatabaseClient, sessionId: string) {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  return db.select().from(users).where(eq(users.id, session.userId)).get() ?? null;
}

export function deleteSession(db: DatabaseClient, sessionId: string) {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
