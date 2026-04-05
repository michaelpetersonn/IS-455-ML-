import postgres from 'postgres';

// DATABASE_URL must be set in .env.local (dev) and Vercel env vars (prod).
// Use the Supabase Transaction Mode connection string (port 6543) for serverless compatibility.
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 5,               // connection pool size — safe for Vercel serverless
  idle_timeout: 20,
  connect_timeout: 10,
  types: {
    // PostgreSQL NUMERIC returns strings by default — parse them as JS floats
    numeric: {
      to:        1700,
      from:      [1700],
      serialize: (x) => String(x),
      parse:     (x) => parseFloat(x),
    },
  },
});

/** Run a SELECT and return all rows. Pass params as rest args. */
export async function all(query, ...params) {
  return sql.unsafe(query, params);
}

/** Run a SELECT and return one row (or null). */
export async function get(query, ...params) {
  const rows = await sql.unsafe(query, params);
  return rows[0] ?? null;
}

/** Run an INSERT / UPDATE / DELETE. Returns the result rows (use RETURNING to get ids). */
export async function run(query, ...params) {
  return sql.unsafe(query, params);
}

/** Run multiple statements in a single transaction. fn receives (sql) — use module-level helpers inside. */
export async function transaction(fn) {
  return sql.begin(fn);
}

export { sql };
