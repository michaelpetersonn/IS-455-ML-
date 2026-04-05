/**
 * Seed script — connects to Supabase (PostgreSQL) and populates it with
 * sample data using the schema in supabase/schema.sql.
 *
 * Setup:
 *   1. Create web/.env.local with DATABASE_URL=<your Supabase Transaction Mode URL>
 *   2. Run the schema in Supabase SQL Editor first (supabase/schema.sql)
 *   3. From the web/ directory: npm run seed
 */

import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Add it to web/.env.local');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

console.log('Connecting to Supabase and seeding data…');

// ── Drop and recreate (mirrors supabase/schema.sql) ──────────────────────────
await sql.unsafe(`
  TRUNCATE order_predictions, order_items, orders, products, customer_predictions, customers RESTART IDENTITY CASCADE;
`);

// ── Customers ─────────────────────────────────────────────────────────────────
const customerRows = [
  { full_name: 'Alice Johnson',  email: 'alice@example.com',  loyalty_tier: 'gold',   customer_segment: 'premium',  created_at: '2022-06-15' },
  { full_name: 'Bob Martinez',   email: 'bob@example.com',    loyalty_tier: 'silver', customer_segment: 'standard', created_at: '2023-01-10' },
  { full_name: 'Carol White',    email: 'carol@example.com',  loyalty_tier: 'bronze', customer_segment: 'standard', created_at: '2024-03-20' },
  { full_name: 'David Lee',      email: 'david@example.com',  loyalty_tier: 'gold',   customer_segment: 'premium',  created_at: '2022-11-05' },
  { full_name: 'Eva Nguyen',     email: 'eva@example.com',    loyalty_tier: 'silver', customer_segment: 'standard', created_at: '2023-08-14' },
  { full_name: 'Frank Torres',   email: 'frank@example.com',  loyalty_tier: 'bronze', customer_segment: 'budget',   created_at: '2024-07-01' },
  { full_name: 'Grace Kim',      email: 'grace@example.com',  loyalty_tier: 'gold',   customer_segment: 'premium',  created_at: '2021-12-22' },
  { full_name: 'Henry Brown',    email: 'henry@example.com',  loyalty_tier: 'silver', customer_segment: 'standard', created_at: '2023-04-30' },
];

for (const c of customerRows) {
  await sql`
    INSERT INTO customers (full_name, email, loyalty_tier, customer_segment, created_at)
    VALUES (${c.full_name}, ${c.email}, ${c.loyalty_tier}, ${c.customer_segment}, ${c.created_at})
  `;
}
console.log(`  Inserted ${customerRows.length} customers`);

// ── Products ──────────────────────────────────────────────────────────────────
const productRows = [
  { product_name: 'Laptop Pro 15',           category: 'Electronics', price: 1199.99 },
  { product_name: 'Wireless Mouse',          category: 'Electronics', price: 29.99   },
  { product_name: 'USB-C Hub',               category: 'Electronics', price: 49.99   },
  { product_name: 'Noise-Cancel Headphones', category: 'Electronics', price: 249.99  },
  { product_name: 'Mechanical Keyboard',     category: 'Electronics', price: 149.99  },
  { product_name: 'Python Programming',      category: 'Books',       price: 39.99   },
  { product_name: 'Data Science Handbook',   category: 'Books',       price: 44.99   },
  { product_name: 'Clean Code',              category: 'Books',       price: 34.99   },
  { product_name: 'Standing Desk',           category: 'Office',      price: 399.99  },
  { product_name: 'Monitor 27"',             category: 'Electronics', price: 329.99  },
  { product_name: 'Desk Lamp',               category: 'Office',      price: 49.99   },
  { product_name: 'Webcam HD',               category: 'Electronics', price: 79.99   },
];

for (const p of productRows) {
  await sql`
    INSERT INTO products (product_name, category, price, stock_qty, is_active)
    VALUES (${p.product_name}, ${p.category}, ${p.price}, 100, 1)
  `;
}
console.log(`  Inserted ${productRows.length} products`);

// ── Helper utilities ──────────────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

const paymentMethods = ['card', 'card', 'card', 'paypal', 'bank', 'crypto'];
const deviceTypes    = ['desktop', 'desktop', 'mobile', 'mobile', 'tablet'];
const countries      = ['US', 'US', 'US', 'US', 'CA', 'GB', 'NG', 'RU'];

const allProducts = await sql`SELECT product_id, price FROM products`;
const customers   = await sql`SELECT customer_id, loyalty_tier FROM customers`;

// ── Seed orders ───────────────────────────────────────────────────────────────
let totalOrders = 0;

// Historical fulfilled orders (20–35 per customer)
for (const cust of customers) {
  const count = randInt(20, 35);
  for (let i = 0; i < count; i++) {
    const daysAgo = randInt(10, 400);
    const payment = pick(paymentMethods);
    const device  = pick(deviceTypes);
    const country = pick(countries);
    const promo   = Math.random() < 0.2 ? 1 : 0;

    const isFraud = (country === 'NG' || country === 'RU') && payment === 'crypto' && Math.random() < 0.7
      ? 1
      : Math.random() < 0.05 ? 1 : 0;

    const riskScore = isFraud
      ? randInt(60, 95)
      : country !== 'US' && country !== 'CA' && country !== 'GB'
        ? randInt(30, 60)
        : randInt(0, 30);

    const numItems = randInt(1, 3);
    const chosen = [];
    for (let j = 0; j < numItems; j++) chosen.push(pick(allProducts));

    const subtotal = chosen.reduce((s, p) => s + Number(p.price), 0);
    const shipping = subtotal > 200 ? 0 : 9.99;
    const tax      = parseFloat((subtotal * 0.08).toFixed(2));
    const total    = parseFloat((subtotal + shipping + tax).toFixed(2));

    const [order] = await sql`
      INSERT INTO orders (customer_id, order_datetime, payment_method, device_type, ip_country,
                          promo_used, order_subtotal, shipping_fee, tax_amount, order_total,
                          risk_score, is_fraud, fulfilled)
      VALUES (${cust.customer_id}, ${pastDate(daysAgo)}, ${payment}, ${device}, ${country},
              ${promo}, ${subtotal}, ${shipping}, ${tax}, ${total}, ${riskScore}, ${isFraud}, 1)
      RETURNING order_id
    `;
    for (const p of chosen) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
        VALUES (${order.order_id}, ${p.product_id}, 1, ${p.price}, ${p.price})
      `;
    }
    totalOrders++;
  }
}

// Pending (unfulfilled) orders — shown in warehouse queue
for (const cust of customers) {
  const count = randInt(2, 5);
  for (let i = 0; i < count; i++) {
    const daysAgo = randInt(0, 7);
    const payment = pick(paymentMethods);
    const device  = pick(deviceTypes);
    const country = pick(countries);
    const promo   = Math.random() < 0.15 ? 1 : 0;

    const isFraud   = payment === 'crypto' && (country === 'NG' || country === 'RU') ? 1 : 0;
    const riskScore = isFraud ? randInt(55, 90) : randInt(2, 35);

    const numItems = randInt(1, 4);
    const chosen = [];
    for (let j = 0; j < numItems; j++) chosen.push(pick(allProducts));

    const subtotal = chosen.reduce((s, p) => s + Number(p.price), 0);
    const shipping = subtotal > 200 ? 0 : 9.99;
    const tax      = parseFloat((subtotal * 0.08).toFixed(2));
    const total    = parseFloat((subtotal + shipping + tax).toFixed(2));

    const [order] = await sql`
      INSERT INTO orders (customer_id, order_datetime, payment_method, device_type, ip_country,
                          promo_used, order_subtotal, shipping_fee, tax_amount, order_total,
                          risk_score, is_fraud, fulfilled)
      VALUES (${cust.customer_id}, ${pastDate(daysAgo)}, ${payment}, ${device}, ${country},
              ${promo}, ${subtotal}, ${shipping}, ${tax}, ${total}, ${riskScore}, ${isFraud}, 0)
      RETURNING order_id
    `;
    for (const p of chosen) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
        VALUES (${order.order_id}, ${p.product_id}, 1, ${p.price}, ${p.price})
      `;
    }
    totalOrders++;
  }
}

const [counts]  = await sql`SELECT COUNT(*) AS n FROM orders`;
const [pending] = await sql`SELECT COUNT(*) AS n FROM orders WHERE fulfilled = 0`;
const [fraud]   = await sql`SELECT COUNT(*) AS n FROM orders WHERE is_fraud = 1`;

console.log(`Done. Orders: ${counts.n} total | ${pending.n} pending | ${fraud.n} fraud`);
console.log('Run "npm run dev" from web/ to start the app.');

await sql.end();
