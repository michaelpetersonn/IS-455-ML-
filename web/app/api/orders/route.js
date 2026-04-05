import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { all, get, sql } from '@/lib/db';

export async function GET() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  if (!customerId) return NextResponse.json({ error: 'No customer selected' }, { status: 401 });

  const orders = await all(
    `SELECT o.order_id AS id, o.order_datetime AS order_date,
            CASE WHEN o.is_fraud=1 THEN 'cancelled' WHEN o.fulfilled=1 THEN 'delivered' ELSE 'pending' END AS status,
            o.order_total AS total_amount,
            COUNT(oi.order_item_id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.order_id
     WHERE o.customer_id = $1
     GROUP BY o.order_id
     ORDER BY o.order_datetime DESC`,
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
    const customer = await get(
      'SELECT loyalty_tier AS segment FROM customers WHERE customer_id = $1',
      customerId
    );
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await sql.begin(async (tx) => {
      let totalAmount = 0;
      const lineItems = [];

      for (const { product_id, quantity } of items) {
        if (quantity <= 0) continue;
        const [product] = await tx.unsafe(
          'SELECT product_id AS id, price FROM products WHERE product_id = $1',
          [product_id]
        );
        if (!product) throw new Error(`Product ${product_id} not found`);
        totalAmount += Number(product.price) * quantity;
        lineItems.push({ product_id, quantity, unit_price: Number(product.price) });
      }

      if (lineItems.length === 0) throw new Error('No valid items');

      // Insert order — RETURNING gives us the new order_id (replaces lastInsertRowid)
      const [orderRow] = await tx.unsafe(
        `INSERT INTO orders (customer_id, order_datetime, payment_method, device_type, ip_country,
                             promo_used, order_subtotal, shipping_fee, tax_amount, order_total,
                             risk_score, is_fraud, fulfilled)
         VALUES ($1, NOW()::text, 'card', 'desktop', 'US', 0, $2, 0, 0, $3, 0, 0, 0)
         RETURNING order_id`,
        [customerId, totalAmount, totalAmount]
      );
      const orderId = orderRow.order_id;

      for (const li of lineItems) {
        await tx.unsafe(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES ($1, $2, $3, $4, $5)',
          [orderId, li.product_id, li.quantity, li.unit_price, li.quantity * li.unit_price]
        );
      }

      return { orderId, totalAmount };
    });

    return NextResponse.json({ order_id: result.orderId, total: result.totalAmount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
