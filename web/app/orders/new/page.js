'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlaceOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { productId: qty }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setError('Failed to load products.'));
  }, []);

  const setQty = (id, qty) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const total = products.reduce((sum, p) => {
    return sum + (cart[p.id] ?? 0) * p.price;
  }, 0);

  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (itemCount === 0) { setError('Add at least one item.'); return; }
    setError('');
    setSubmitting(true);
    const items = Object.entries(cart).map(([product_id, quantity]) => ({
      product_id: Number(product_id),
      quantity,
    }));
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      setSuccess(`Order #${data.order_id} placed! Total: $${data.total.toFixed(2)}`);
      setCart({});
      setTimeout(() => router.push('/orders/history'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <h1>Place Order</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Product list */}
          <div>
            {Object.keys(byCategory).length === 0 && !error && (
              <div className="card"><p className="empty">Loading products…</p></div>
            )}
            {Object.entries(byCategory).map(([cat, prods]) => (
              <div className="card" key={cat} style={{ marginBottom: '1rem' }}>
                <h2>{cat}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Product</th><th>Price</th><th>Stock</th><th>Qty</th></tr>
                    </thead>
                    <tbody>
                      {prods.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>${p.price.toFixed(2)}</td>
                          <td style={{ color: p.stock_qty < 5 ? 'var(--danger)' : 'inherit' }}>
                            {p.stock_qty}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={p.stock_qty}
                              value={cart[p.id] ?? 0}
                              onChange={(e) => setQty(p.id, Number(e.target.value))}
                              style={{ width: 70 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Cart summary */}
          <div className="card" style={{ position: 'sticky', top: '72px' }}>
            <h2>Order Summary</h2>
            {itemCount === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                No items added yet.
              </p>
            ) : (
              <table style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
                <tbody>
                  {Object.entries(cart).map(([pid, qty]) => {
                    const p = products.find((x) => x.id === Number(pid));
                    if (!p) return null;
                    return (
                      <tr key={pid}>
                        <td style={{ paddingLeft: 0 }}>{p.name}</td>
                        <td>×{qty}</td>
                        <td style={{ textAlign: 'right', paddingRight: 0 }}>
                          ${(p.price * qty).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              Total: ${total.toFixed(2)}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting || itemCount === 0}
            >
              {submitting ? 'Placing…' : 'Place Order'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
