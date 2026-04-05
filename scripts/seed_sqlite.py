"""
seed_sqlite.py — Seeds shop.db (SQLite) for the Jupyter notebook.
Run from the project root: python scripts/seed_sqlite.py
"""
import sqlite3, pathlib, random, datetime

DB_PATH = pathlib.Path(__file__).parent.parent / 'shop.db'
print(f'Seeding {DB_PATH}')

con = sqlite3.connect(DB_PATH)
con.execute('PRAGMA foreign_keys = ON')

con.executescript("""
DROP TABLE IF EXISTS order_predictions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customer_predictions;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  customer_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  loyalty_tier     TEXT NOT NULL DEFAULT 'bronze',
  customer_segment TEXT NOT NULL DEFAULT 'standard',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE products (
  product_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  category     TEXT NOT NULL,
  price        REAL NOT NULL,
  stock_qty    INTEGER NOT NULL DEFAULT 100,
  is_active    INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE orders (
  order_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES customers(customer_id),
  order_datetime TEXT NOT NULL DEFAULT (datetime('now')),
  payment_method TEXT NOT NULL DEFAULT 'card',
  device_type    TEXT NOT NULL DEFAULT 'desktop',
  ip_country     TEXT NOT NULL DEFAULT 'US',
  promo_used     INTEGER NOT NULL DEFAULT 0,
  order_subtotal REAL NOT NULL DEFAULT 0,
  shipping_fee   REAL NOT NULL DEFAULT 0,
  tax_amount     REAL NOT NULL DEFAULT 0,
  order_total    REAL NOT NULL DEFAULT 0,
  risk_score     REAL NOT NULL DEFAULT 0,
  is_fraud       INTEGER NOT NULL DEFAULT 0,
  fulfilled      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE order_items (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(order_id),
  product_id    INTEGER NOT NULL REFERENCES products(product_id),
  quantity      INTEGER NOT NULL,
  unit_price    REAL NOT NULL,
  line_total    REAL NOT NULL
);
CREATE TABLE order_predictions (
  order_id             INTEGER PRIMARY KEY REFERENCES orders(order_id),
  fraud_probability    REAL,
  predicted_fraud      INTEGER,
  prediction_timestamp TEXT
);
CREATE TABLE customer_predictions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL,
  churn_prob     REAL,
  predicted_ltv  REAL,
  priority_score REAL,
  scored_at      TEXT NOT NULL DEFAULT (datetime('now')),
  model_version  TEXT NOT NULL DEFAULT 'heuristic-v1'
);
""")

customers = [
    ('Alice Johnson',  'alice@example.com',  'gold',   'premium',  '2022-06-15'),
    ('Bob Martinez',   'bob@example.com',    'silver', 'standard', '2023-01-10'),
    ('Carol White',    'carol@example.com',  'bronze', 'standard', '2024-03-20'),
    ('David Lee',      'david@example.com',  'gold',   'premium',  '2022-11-05'),
    ('Eva Nguyen',     'eva@example.com',    'silver', 'standard', '2023-08-14'),
    ('Frank Torres',   'frank@example.com',  'bronze', 'budget',   '2024-07-01'),
    ('Grace Kim',      'grace@example.com',  'gold',   'premium',  '2021-12-22'),
    ('Henry Brown',    'henry@example.com',  'silver', 'standard', '2023-04-30'),
]
con.executemany(
    'INSERT INTO customers (full_name,email,loyalty_tier,customer_segment,created_at) VALUES (?,?,?,?,?)',
    customers
)

products = [
    ('Laptop Pro 15',           'Electronics', 1199.99),
    ('Wireless Mouse',          'Electronics', 29.99),
    ('USB-C Hub',               'Electronics', 49.99),
    ('Noise-Cancel Headphones', 'Electronics', 249.99),
    ('Mechanical Keyboard',     'Electronics', 149.99),
    ('Python Programming',      'Books',       39.99),
    ('Data Science Handbook',   'Books',       44.99),
    ('Clean Code',              'Books',       34.99),
    ('Standing Desk',           'Office',      399.99),
    ('Monitor 27"',             'Electronics', 329.99),
    ('Desk Lamp',               'Office',      49.99),
    ('Webcam HD',               'Electronics', 79.99),
]
con.executemany(
    'INSERT INTO products (product_name,category,price,stock_qty,is_active) VALUES (?,?,?,100,1)',
    products
)
con.commit()

all_products = con.execute('SELECT product_id, price FROM products').fetchall()
all_customers = con.execute('SELECT customer_id FROM customers').fetchall()

payment_methods = ['card','card','card','paypal','bank','crypto']
device_types    = ['desktop','desktop','mobile','mobile','tablet']
countries       = ['US','US','US','US','CA','GB','NG','RU']

def past_date(days_ago):
    d = datetime.datetime.now() - datetime.timedelta(days=days_ago)
    return d.strftime('%Y-%m-%d %H:%M:%S')

total = 0
for (cid,) in all_customers:
    # Historical fulfilled orders
    for _ in range(random.randint(20, 35)):
        payment = random.choice(payment_methods)
        device  = random.choice(device_types)
        country = random.choice(countries)
        promo   = 1 if random.random() < 0.2 else 0
        is_fraud = 1 if (country in ('NG','RU') and payment == 'crypto' and random.random() < 0.7) \
                     else (1 if random.random() < 0.05 else 0)
        risk    = random.randint(60,95) if is_fraud else \
                  (random.randint(30,60) if country not in ('US','CA','GB') else random.randint(0,30))
        chosen  = random.sample(all_products, k=random.randint(1,3))
        subtotal = sum(p[1] for p in chosen)
        shipping = 0 if subtotal > 200 else 9.99
        tax      = round(subtotal * 0.08, 2)
        total_amt = round(subtotal + shipping + tax, 2)
        cur = con.execute(
            '''INSERT INTO orders (customer_id,order_datetime,payment_method,device_type,ip_country,
               promo_used,order_subtotal,shipping_fee,tax_amount,order_total,risk_score,is_fraud,fulfilled)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)''',
            (cid, past_date(random.randint(10,400)), payment, device, country,
             promo, subtotal, shipping, tax, total_amt, risk, is_fraud)
        )
        oid = cur.lastrowid
        for pid, price in chosen:
            con.execute('INSERT INTO order_items VALUES (NULL,?,?,1,?,?)', (oid,pid,price,price))
        total += 1
    # Pending orders
    for _ in range(random.randint(2, 5)):
        payment = random.choice(payment_methods)
        device  = random.choice(device_types)
        country = random.choice(countries)
        promo   = 1 if random.random() < 0.15 else 0
        is_fraud = 1 if (payment == 'crypto' and country in ('NG','RU')) else 0
        risk    = random.randint(55,90) if is_fraud else random.randint(2,35)
        chosen  = random.sample(all_products, k=random.randint(1,4))
        subtotal = sum(p[1] for p in chosen)
        shipping = 0 if subtotal > 200 else 9.99
        tax      = round(subtotal * 0.08, 2)
        total_amt = round(subtotal + shipping + tax, 2)
        cur = con.execute(
            '''INSERT INTO orders (customer_id,order_datetime,payment_method,device_type,ip_country,
               promo_used,order_subtotal,shipping_fee,tax_amount,order_total,risk_score,is_fraud,fulfilled)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)''',
            (cid, past_date(random.randint(0,7)), payment, device, country,
             promo, subtotal, shipping, tax, total_amt, risk, is_fraud)
        )
        oid = cur.lastrowid
        for pid, price in chosen:
            con.execute('INSERT INTO order_items VALUES (NULL,?,?,1,?,?)', (oid,pid,price,price))
        total += 1

con.commit()
counts = con.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
pending = con.execute('SELECT COUNT(*) FROM orders WHERE fulfilled=0').fetchone()[0]
fraud   = con.execute('SELECT COUNT(*) FROM orders WHERE is_fraud=1').fetchone()[0]
con.close()
print(f'Done. Orders: {counts} total | {pending} pending | {fraud} fraud')
