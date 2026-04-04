import { cookies } from 'next/headers';
import Link from 'next/link';
import { get } from '@/lib/db';
import './globals.css';

export const metadata = { title: 'IS-455 ML Shop' };

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  let customer = null;
  if (customerId) {
    try {
      customer = get(
        'SELECT full_name AS name, loyalty_tier AS segment FROM customers WHERE customer_id = ?',
        customerId
      );
    } catch {
      // DB may not be seeded yet
    }
  }

  return (
    <html lang="en">
      <body>
        <nav>
          <span className="nav-brand">IS-455 ML Shop</span>
          <div className="nav-links">
            <Link href="/">Select Customer</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/orders/new">Place Order</Link>
            <Link href="/orders/history">Order History</Link>
            <Link href="/warehouse">Warehouse Queue</Link>
            <Link href="/scoring">Run Scoring</Link>
          </div>
          {customer ? (
            <div className="nav-customer">
              Acting as:&nbsp;<strong>{customer.name}</strong>
              <span className={`badge badge-${customer.segment}`}>{customer.segment}</span>
            </div>
          ) : (
            <div className="nav-customer" style={{ color: 'var(--danger)' }}>
              No customer selected
            </div>
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
