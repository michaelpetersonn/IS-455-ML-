import { all } from '@/lib/db';
import { selectCustomerAction } from './actions';

export const dynamic = 'force-dynamic';

export default function SelectCustomerPage() {
  let customers = [];
  try {
    customers = all('SELECT customer_id AS id, full_name AS name, email, loyalty_tier AS segment FROM customers ORDER BY full_name');
  } catch {
    // DB not seeded yet
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto' }}>
      <div className="card">
        <h1 style={{ marginBottom: '0.5rem' }}>Select a Customer</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Choose an existing customer to act as. No login required.
        </p>

        {customers.length === 0 ? (
          <div className="alert alert-error">
            No customers found. Run <code>npm run seed</code> from the <code>web/</code>
            directory to populate the database.
          </div>
        ) : (
          <form action={selectCustomerAction}>
            <div className="form-group">
              <label htmlFor="customer_id">Customer</label>
              <select name="customer_id" id="customer_id" required>
                <option value="">— pick one —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) — {c.segment}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Continue →
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
