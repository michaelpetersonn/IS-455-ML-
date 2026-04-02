import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { get, run, transaction } from '@/lib/db';

export async function GET() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  if (!customerId) return NextResponse.json({ error: 'No customer selected' }, { status: 401 });

  const orders = (await import('@/lib/db')).all(
    `SELECT o.id, o.order_date, o.status, o.total_amount,
            COUNT(oi.id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ?
     GROUP BY o.id
     ORDER BY o.order_date DESC`,
    customerId
  );
  return NextResponse.json(orders);
}

export async function POST(request) {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  if (!customerId) return NextResponse.json({ error: 'No customer selected' }, { status: 401 });

  const body = await request.json();
  const { items } = body; // [{ product_id, quantity }]

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  try {
    const customer = get('SELECT segment FROM customers WHERE id = ?', customerId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = transaction(() => {
      let totalAmount = 0;
      const lineItems = [];

      for (const { product_id, quantity } of items) {
        if (quantity <= 0) continue;
        const product = get('SELECT id, price, stock_qty FROM products WHERE id = ?', product_id);
        if (!product) throw new Error(`Product ${product_id} not found`);
        if (product.stock_qty < quantity) throw new Error(`Not enough stock for product ${product_id}`);
        totalAmount += product.price * quantity;
        lineItems.push({ product_id, quantity, unit_price: product.price });
      }

      if (lineItems.length === 0) throw new Error('No valid items');

      // Insert order
      const orderRes = run(
        `INSERT INTO orders (customer_id, order_date, status, total_amount)
         VALUES (?, datetime('now'), 'pending', ?)`,
        customerId, totalAmount
      );
      const orderId = orderRes.lastInsertRowid;

      // Insert line items and reduce stock
      for (const li of lineItems) {
        run(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          orderId, li.product_id, li.quantity, li.unit_price
        );
        run(
          'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
          li.quantity, li.product_id
        );
      }

      return { orderId, totalAmount };
    });

    return NextResponse.json({ order_id: result.orderId, total: result.totalAmount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
