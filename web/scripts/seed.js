/**
 * Seed script — creates shop.db at the project root (one level up from web/)
 * and populates it with sample data.
 *
 * Run: npm run seed   (from the web/ directory)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'shop.db');
console.log(`Creating / resetting database at: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    UNIQUE NOT NULL,
    segment     TEXT    NOT NULL DEFAULT 'bronze'
                        CHECK(segment IN ('bronze','silver','gold')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    price       REAL    NOT NULL,
    stock_qty   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL REFERENCES customers(id),
    order_date    TEXT    NOT NULL DEFAULT (datetime('now')),
    status        TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
    total_amount  REAL    NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id),
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  REAL    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_predictions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    churn_prob     REAL,
    predicted_ltv  REAL,
    priority_score REAL,
    scored_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    model_version  TEXT    NOT NULL DEFAULT 'heuristic-v1'
  );
`);

// ── Customers ─────────────────────────────────────────────────────────────────
const customers = [
  { name: 'Alice Johnson',  email: 'alice@example.com',  segment: 'gold',   created_at: '2023-01-15' },
  { name: 'Bob Martinez',   email: 'bob@example.com',    segment: 'silver', created_at: '2023-03-22' },
  { name: 'Carol White',    email: 'carol@example.com',  segment: 'bronze', created_at: '2024-06-01' },
  { name: 'David Lee',      email: 'david@example.com',  segment: 'gold',   created_at: '2022-11-05' },
  { name: 'Eva Nguyen',     email: 'eva@example.com',    segment: 'silver', created_at: '2024-01-10' },
  { name: 'Frank Torres',   email: 'frank@example.com',  segment: 'bronze', created_at: '2025-02-20' },
  { name: 'Grace Kim',      email: 'grace@example.com',  segment: 'gold',   created_at: '2022-08-14' },
  { name: 'Henry Brown',    email: 'henry@example.com',  segment: 'silver', created_at: '2023-07-30' },
];

const insertCustomer = db.prepare(
  `INSERT OR IGNORE INTO customers (name, email, segment, created_at) VALUES (?, ?, ?, ?)`
);
for (const c of customers) insertCustomer.run(c.name, c.email, c.segment, c.created_at);

// ── Products ──────────────────────────────────────────────────────────────────
const products = [
  { name: 'Laptop Pro 15"',     category: 'Electronics',  price: 1299.99, stock_qty: 25 },
  { name: 'Wireless Mouse',     category: 'Electronics',  price:   29.99, stock_qty: 120 },
  { name: 'USB-C Hub',          category: 'Electronics',  price:   49.99, stock_qty: 80 },
  { name: 'Mechanical Keyboard',category: 'Electronics',  price:   89.99, stock_qty: 60 },
  { name: 'Monitor 27" 4K',     category: 'Electronics',  price:  449.99, stock_qty: 30 },
  { name: 'Python Crash Course', category: 'Books',        price:   34.99, stock_qty: 200 },
  { name: 'Clean Code',          category: 'Books',        price:   39.99, stock_qty: 150 },
  { name: 'Deep Learning Book',  category: 'Books',        price:   59.99, stock_qty: 90 },
  { name: 'Desk Lamp LED',       category: 'Office',       price:   24.99, stock_qty: 75 },
  { name: 'Ergonomic Chair',     category: 'Office',       price:  299.99, stock_qty: 15 },
  { name: 'Notebook Set',        category: 'Office',       price:   12.99, stock_qty: 300 },
  { name: 'Cable Organizer',     category: 'Office',       price:    9.99, stock_qty: 200 },
];

const insertProduct = db.prepare(
  `INSERT OR IGNORE INTO products (name, category, price, stock_qty) VALUES (?, ?, ?, ?)`
);
for (const p of products) insertProduct.run(p.name, p.category, p.price, p.stock_qty);

// ── Orders (historical) ───────────────────────────────────────────────────────
const allCustomers = db.prepare('SELECT id FROM customers').all();
const allProducts  = db.prepare('SELECT id, price FROM products').all();

const insertOrder = db.prepare(
  `INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES (?, ?, ?, ?)`
);
const insertItem = db.prepare(
  `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`
);

const statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'delivered'];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomItem(arr) { return arr[randomInt(0, arr.length - 1)]; }
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const seedOrders = db.transaction(() => {
  // Check if orders already exist to avoid duplicate seeding
  const existing = db.prepare('SELECT COUNT(*) AS n FROM orders').get();
  if (existing.n > 0) { console.log('Orders already exist, skipping order seed.'); return; }

  for (const customer of allCustomers) {
    const numOrders = randomInt(2, 8);
    for (let o = 0; o < numOrders; o++) {
      const daysAgo = randomInt(1, 400);
      const status  = randomItem(statuses);
      const numItems = randomInt(1, 3);
      let total = 0;
      const lineItems = [];
      for (let i = 0; i < numItems; i++) {
        const product = randomItem(allProducts);
        const qty = randomInt(1, 3);
        total += product.price * qty;
        lineItems.push({ product_id: product.id, quantity: qty, unit_price: product.price });
      }
      const orderRes = insertOrder.run(customer.id, pastDate(daysAgo), status, total);
      for (const li of lineItems) {
        insertItem.run(orderRes.lastInsertRowid, li.product_id, li.quantity, li.unit_price);
      }
    }
  }
});

seedOrders();

const counts = {
  customers: db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
  products:  db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
  orders:    db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
};
console.log(`\n✓ Database seeded:`);
console.log(`  customers: ${counts.customers}`);
console.log(`  products:  ${counts.products}`);
console.log(`  orders:    ${counts.orders}`);
console.log(`\nRun  npm run dev  to start the app.\n`);
