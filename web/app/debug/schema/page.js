import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function SchemaPage() {
  let tables = [];
  let error = null;

  try {
    tables = all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).map((row) => ({
      name: row.name,
      columns: all(`PRAGMA table_info(${row.name})`),
      rowCount: all(`SELECT COUNT(*) AS n FROM "${row.name}"`)[0].n,
    }));
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
        Live view of <code>shop.db</code>. Use this to verify your schema and update prompts if column names differ.
      </p>

      {error ? (
        <div className="alert alert-error">
          Could not open database: {error}
        </div>
      ) : tables.length === 0 ? (
        <div className="alert alert-error">
          No tables found. Run <code>npm run seed</code> to initialise the database.
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
                    <th>cid</th>
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
