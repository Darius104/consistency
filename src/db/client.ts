import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

// Reuses one connection for the app's lifetime. The schema itself is
// created by the Rust-side migration registered in src-tauri/src/lib.rs.
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    // SQLite disables foreign key enforcement per-connection by default;
    // this is required for ON DELETE CASCADE / SET NULL to actually apply.
    dbPromise = Database.load("sqlite:app.db").then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON;");
      return db;
    });
  }
  return dbPromise;
}
