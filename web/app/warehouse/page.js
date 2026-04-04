import { all } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/*
  Late Delivery Priority Queue — top 50 orders.

  Priority score logic (computed in SQL):
    base 100
    + days_since_order * 3       (older orders rise)
    - (CASE segment WHEN 'gold' THEN 30 WHEN 'silver' THEN 15 ELSE 0 END) * -1
      → gold customers get HIGHER priority (lower number = served sooner),
        so we ADD bonus to gold
    + COALESCE(op.priority_score, 0)   (ML model score)

  Only 'pending' and 'processing' orders are shown.
*/

export default function WarehousePage({ searchParams }) {
  const filter = searchParams?.customer?.trim().toLowerCase() ?? '';
  let queue = [];
  try {
    queue = all(`
      SELECT
        o.order_id,
        o.order_datetime                                    AS order_date,
        CASE WHEN o.is_fraud=1 THEN 'cancelled' WHEN o.fulfilled=1 THEN 'delivered' ELSE 'pending' END
                                                            AS status,
        o.order_total                                       AS total_amount,
        c.full_name                                         AS customer_name,
        c.loyalty_tier                                      AS segment,
        CAST(julianday('now') - julianday(o.order_datetime) AS INTEGER)
                                                            AS days_waiting,
        COALESCE(op.late_delivery_probability * 100, 50)    AS ml_priority,
        COALESCE(op.late_delivery_probability, 0)           AS churn_prob,
        -- composite warehouse priority (higher = more urgent)
        (
          CAST(julianday('now') - julianday(o.order_datetime) AS INTEGER) * 3
          + CASE c.loyalty_tier WHEN 'gold' THEN 30 WHEN 'silver' THEN 15 ELSE 0 END
          + COALESCE(op.late_delivery_probability * 100, 50)
        )                                                   AS priority
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN order_predictions op ON op.order_id = o.order_id
      WHERE o.fulfilled = 0 AND o.is_fraud = 0
        ${filter ? `AND lower(c.full_name) LIKE '%' || lower(?) || '%'` : ''}
      ORDER BY priority DESC
      LIMIT 50
    `, ...(filter ? [filter] : []));
  } catch {
    // DB may not exist yet
  }

  const fmt = (n) => Number(n).toFixed(2);

  return (
    <>
      <div className="page-header">
        <h1>Warehouse Priority Queue</h1>
        <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          {filter ? `Filtered · ` : 'Top 50 open orders · '}sorted by priority
        </span>
      </div>

      <form method="GET" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          name="customer"
          defaultValue={filter}
          placeholder="Filter by customer name…"
          style={{ flex: 1, padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1rem' }}>Filter</button>
        {filter && <a href="/warehouse" className="btn" style={{ padding: '0.4rem 1rem' }}>Clear</a>}
      </form>

      {queue.length === 0 ? (
        <div className="card">
          <p className="empty">
            No open orders in queue.{' '}
            <Link href="/orders/new">Place an order</Link> or{' '}
            <Link href="/scoring">run scoring</Link> to populate ML scores.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Segment</th>
                  <th>Days Waiting</th>
                  <th>Total</th>
                  <th>Churn Risk</th>
                  <th>ML Score</th>
                  <th>Priority ↓</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row, i) => (
                  <tr key={row.order_id}>
                    <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{i + 1}</td>
                    <td>#{row.order_id}</td>
                    <td>{row.customer_name}</td>
                    <td>
                      <span className={`badge badge-${row.segment}`}>{row.segment}</span>
                    </td>
                    <td style={{ color: row.days_waiting > 5 ? 'var(--danger)' : 'inherit', fontWeight: row.days_waiting > 5 ? 700 : 400 }}>
                      {row.days_waiting}d
                    </td>
                    <td>${fmt(row.total_amount)}</td>
                    <td style={{ color: row.churn_prob > 0.6 ? 'var(--danger)' : row.churn_prob > 0.3 ? 'var(--warning)' : 'var(--success)' }}>
                      {(row.churn_prob * 100).toFixed(0)}%
                    </td>
                    <td>{Number(row.ml_priority).toFixed(1)}</td>
                    <td style={{ fontWeight: 700 }}>{Number(row.priority).toFixed(0)}</td>
                    <td>
                      <span className={`badge badge-${row.status}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
