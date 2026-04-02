import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { all, get } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function OrderHistoryPage() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  if (!customerId) redirect('/');

  const customer = get('SELECT name FROM customers WHERE id = ?', customerId);
  if (!customer) redirect('/');

  const orders = all(
    `SELECT o.id, o.order_date, o.status, o.total_amount,
            COUNT(oi.id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ?
     GROUP BY o.id
     ORDER BY o.order_date DESC`,
    customerId
  );

  // For the expanded view, also pull line items per order (top 50 orders)
  const items = all(
    `SELECT oi.order_id, p.name AS product_name, oi.quantity, oi.unit_price
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id IN (
       SELECT id FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 50
     )
     ORDER BY oi.order_id DESC`,
    customerId
  );

  const itemsByOrder = items.reduce((acc, i) => {
    (acc[i.order_id] = acc[i.order_id] || []).push(i);
    return acc;
  }, {});

  const fmt = (n) => Number(n).toFixed(2);

  return (
    <>
      <div className="page-header">
        <h1>Order History</h1>
        <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{customer.name}</span>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <p className="empty">No orders yet. <a href="/orders/new">Place your first order →</a></p>
        </div>
      ) : (
        orders.map((o) => (
          <div className="card" key={o.id} style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700 }}>Order #{o.id}</span>
                <span className={`badge badge-${o.status}`}>{o.status}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>${fmt(o.total_amount)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{o.order_date?.slice(0, 10)}</div>
              </div>
            </div>
            {itemsByOrder[o.id] && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {itemsByOrder[o.id].map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.product_name}</td>
                        <td>{item.quantity}</td>
                        <td>${fmt(item.unit_price)}</td>
                        <td>${fmt(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
