-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- Safe to re-run: drops all tables first then recreates them.

DROP TABLE IF EXISTS order_predictions   CASCADE;
DROP TABLE IF EXISTS order_items         CASCADE;
DROP TABLE IF EXISTS orders              CASCADE;
DROP TABLE IF EXISTS products            CASCADE;
DROP TABLE IF EXISTS customer_predictions CASCADE;
DROP TABLE IF EXISTS customers           CASCADE;

CREATE TABLE customers (
  customer_id      SERIAL PRIMARY KEY,
  full_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  loyalty_tier     TEXT NOT NULL DEFAULT 'bronze'
                   CHECK(loyalty_tier IN ('bronze','silver','gold','none')),
  customer_segment TEXT NOT NULL DEFAULT 'standard',
  created_at       TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE products (
  product_id    SERIAL PRIMARY KEY,
  product_name  TEXT NOT NULL,
  category      TEXT NOT NULL,
  price         NUMERIC NOT NULL,
  stock_qty     INTEGER NOT NULL DEFAULT 100,
  is_active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE orders (
  order_id        SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
  order_datetime  TEXT NOT NULL DEFAULT (NOW()::text),
  payment_method  TEXT NOT NULL DEFAULT 'card',
  device_type     TEXT NOT NULL DEFAULT 'desktop',
  ip_country      TEXT NOT NULL DEFAULT 'US',
  promo_used      INTEGER NOT NULL DEFAULT 0,
  order_subtotal  NUMERIC NOT NULL DEFAULT 0,
  shipping_fee    NUMERIC NOT NULL DEFAULT 0,
  tax_amount      NUMERIC NOT NULL DEFAULT 0,
  order_total     NUMERIC NOT NULL DEFAULT 0,
  risk_score      NUMERIC NOT NULL DEFAULT 0,
  is_fraud        INTEGER NOT NULL DEFAULT 0,
  fulfilled       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(order_id),
  product_id    INTEGER NOT NULL REFERENCES products(product_id),
  quantity      INTEGER NOT NULL,
  unit_price    NUMERIC NOT NULL,
  line_total    NUMERIC NOT NULL
);

CREATE TABLE order_predictions (
  order_id              INTEGER PRIMARY KEY REFERENCES orders(order_id),
  fraud_probability     NUMERIC,
  predicted_fraud       INTEGER,
  prediction_timestamp  TEXT
);

CREATE TABLE customer_predictions (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER NOT NULL,
  churn_prob     NUMERIC,
  predicted_ltv  NUMERIC,
  priority_score NUMERIC,
  scored_at      TEXT NOT NULL DEFAULT (NOW()::text),
  model_version  TEXT NOT NULL DEFAULT 'heuristic-v1'
);
