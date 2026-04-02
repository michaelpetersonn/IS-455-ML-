import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { get, all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  if (!customerId) redirect('/');

  const customer = get(
    `SELECT c.*, p.churn_prob, p.predicted_ltv, p.priority_score, p.scored_at
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, churn_prob, predicted_ltv, priority_score, scored_at
       FROM order_predictions
       WHERE (customer_id, scored_at) IN (
         SELECT customer_id, MAX(scored_at) FROM order_predictions GROUP BY customer_id
       )
     ) p ON p.customer_id = c.id
     WHERE c.id = ?`,
    customerId
  );
  if (!customer) redirect('/');

  const stats = get(
    `SELECT
       COUNT(*)                                   AS order_count,
       COALESCE(SUM(total_amount), 0)             AS total_spent,
       COALESCE(AVG(total_amount), 0)             AS avg_order,
       MAX(order_date)                            AS last_order
     FROM orders WHERE customer_id = ?`,
    customerId
  );

  const recentOrders = all(
    `SELECT id, order_date, status, total_amount
     FROM orders WHERE customer_id = ?
     ORDER BY order_date DESC LIMIT 5`,
    customerId
  );

  const fmt = (n) => Number(n).toFixed(2);
  const pct = (n) => n == null ? '—' : (Number(n) * 100).toFixed(1) + '%';
  const score = (n) => n == null ? '—' : Number(n).toFixed(1);

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link href="/orders/new" className="btn btn-primary">+ Place Order</Link>
      </div>

      {/* Customer info */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{customer.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{customer.email}</div>
          </div>
          <span className={`badge badge-${customer.segment}`}>{customer.segment}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{stats?.order_count ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">${fmt(stats?.total_spent ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Order</div>
          <div className="stat-value">${fmt(stats?.avg_order ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Order</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            {stats?.last_order ? stats.last_order.slice(0, 10) : '—'}
          </div>
        </div>
      </div>

      {/* ML Scores */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>Latest ML Scores {customer.scored_at && <span style={{fontSize:'0.75rem',fontWeight:400,color:'var(--muted)'}}>scored {customer.scored_at?.slice(0,10)}</span>}</h2>
        {customer.churn_prob == null ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            No scores yet. Go to <Link href="/scoring">Run Scoring</Link> to generate predictions.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Churn Risk</div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem', color: customer.churn_prob > 0.6 ? 'var(--danger)' : customer.churn_prob > 0.3 ? 'var(--warning)' : 'var(--success)' }}>
                {pct(customer.churn_prob)}
              </div>
              <div className="score-bar-wrap" style={{ marginTop: '0.4rem' }}>
                <div className="score-bar" style={{ width: `${(customer.churn_prob * 100).toFixed(0)}%`, background: customer.churn_prob > 0.6 ? 'var(--danger)' : customer.churn_prob > 0.3 ? 'var(--warning)' : 'var(--success)' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Predicted LTV</div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>${score(customer.predicted_ltv)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Priority Score</div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{score(customer.priority_score)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ marginBottom: 0 }}>Recent Orders</h2>
          <Link href="/orders/history" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>View all →</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="empty">No orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order #</th><th>Date</th><th>Status</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.order_date?.slice(0, 10)}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    <td>${fmt(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
