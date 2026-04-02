import Database from 'better-sqlite3';
import path from 'path';

// shop.db lives one level up from the web/ directory (project root)
const DB_PATH = path.join(process.cwd(), '..', 'shop.db');

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

/** Run a SELECT and return all rows. Pass params as rest args or a single object. */
export function all(sql, ...params) {
  return getDb().prepare(sql).all(...params);
}

/** Run a SELECT and return one row. */
export function get(sql, ...params) {
  return getDb().prepare(sql).get(...params);
}

/** Run an INSERT / UPDATE / DELETE. Returns { lastInsertRowid, changes }. */
export function run(sql, ...params) {
  return getDb().prepare(sql).run(...params);
}

/** Run multiple statements in a single transaction. fn receives the db. */
export function transaction(fn) {
  return getDb().transaction(fn)();
}
