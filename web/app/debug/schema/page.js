import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SchemaPage() {
  let tables = [];
  let error = null;

  try {
    const tableRows = await all(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    tables = await Promise.all(
      tableRows.map(async (row) => {
        const columns = await all(`
          SELECT
            c.ordinal_position  AS cid,
            c.column_name       AS name,
            c.data_type         AS type,
            CASE c.is_nullable WHEN 'NO' THEN 1 ELSE 0 END AS notnull,
            c.column_default    AS dflt_value,
            CASE WHEN kcu.column_name IS NOT NULL THEN 1 ELSE 0 END AS pk
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema   = tc.table_schema
            WHERE tc.table_schema    = 'public'
              AND tc.table_name      = $1
              AND tc.constraint_type = 'PRIMARY KEY'
          ) kcu ON kcu.column_name = c.column_name
          WHERE c.table_schema = 'public'
            AND c.table_name   = $1
          ORDER BY c.ordinal_position
        `, row.name);

        const [{ n }] = await all(`SELECT COUNT(*) AS n FROM "${row.name}"`);
        return { name: row.name, columns, rowCount: Number(n) };
      })
    );
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <h1>Debug — Database Schema</h1>
        <span style={{ background: '#fef9c3', color: '#92400e', padding: '0.25rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
          DEV ONLY
        </span>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Live view of Supabase tables. Use this to verify your schema and data.
      </p>

      {error ? (
        <div className="alert alert-error">
          Could not connect to database: {error}
        </div>
      ) : tables.length === 0 ? (
        <div className="alert alert-error">
          No tables found. Run <code>npm run seed</code> after setting <code>DATABASE_URL</code>.
        </div>
      ) : (
        tables.map((table) => (
          <div className="card" key={table.name} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h2 style={{ marginBottom: 0, fontFamily: 'monospace', fontSize: '1rem' }}>
                {table.name}
              </h2>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {table.rowCount} row{table.rowCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>name</th>
                    <th>type</th>
                    <th>not null</th>
                    <th>default</th>
                    <th>pk</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col) => (
                    <tr key={col.cid}>
                      <td style={{ color: 'var(--muted)' }}>{col.cid}</td>
                      <td>
                        <code style={{ fontWeight: col.pk ? 700 : 400 }}>{col.name}</code>
                        {col.pk ? <span style={{ color: 'var(--primary)', fontSize: '0.7rem', marginLeft: '0.4rem' }}>PK</span> : null}
                      </td>
                      <td><code style={{ color: '#7c3aed' }}>{col.type || '—'}</code></td>
                      <td style={{ color: col.notnull ? 'var(--success)' : 'var(--muted)' }}>
                        {col.notnull ? 'YES' : 'no'}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>
                        <code>{col.dflt_value ?? '—'}</code>
                      </td>
                      <td>{col.pk ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  );
}
