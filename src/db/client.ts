import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

// The schema itself is created by the Rust-side migration registered in
// src-tauri/src/lib.rs.
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    // Belt-and-suspenders, not strictly required: tauri-plugin-sql holds a
    // real sqlx connection *pool* under the hood (see the withTransaction
    // note below), so this one call only ever reaches whichever single
    // pooled connection happens to service it - it does NOT guarantee every
    // connection in the pool gets this pragma. That's fine here specifically
    // because sqlx's own SqliteConnectOptions defaults `foreign_keys` to ON
    // and re-applies its full pragma list on every single connection it
    // establishes (confirmed by reading sqlx-sqlite's own source,
    // options/mod.rs + options/connect.rs) - every connection this pool
    // ever opens already has foreign keys enforced with zero app-level
    // configuration needed. ON DELETE CASCADE / SET NULL are safe.
    dbPromise = Database.load("sqlite:app.db").then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON;");
      return db;
    });
  }
  return dbPromise;
}

// NOTE: a BEGIN/COMMIT-based withTransaction() helper used to live here.
// Removed - tauri-plugin-sql (confirmed by reading its actual source,
// node_modules/../tauri-plugin-sql-2.4.1/src/wrapper.rs) holds a real
// sqlx connection *pool* under the hood, and every db.execute() call from
// JS is an independent IPC round trip that just does pool.execute(query) -
// acquire a connection, run that one statement, release it. There's no way
// from the JS side to pin a BEGIN/…/COMMIT sequence to the same physical
// connection, so wrapping multi-statement writes this way doesn't produce a
// real transaction - it risks leaving a write lock BEGIN'd on some
// connection with no matching COMMIT, which manifests as intermittent
// "database is locked" failures on completely unrelated later writes. This
// caused a real regression (the offline banner flashing every sync
// attempt) and was reverted.
