# Assignment 17.9 — Vibe Code App

## Goal
Build a simple web app on top of the existing ML pipeline database (`shop.db`). Use an AI coding agent (Claude Code or Cursor) to generate most scaffolding. Your job: provide clear requirements, keep the DB contract stable, and test until behavior matches expectations.

---

## What the App Must Do
- Use existing SQLite file `shop.db`
- **Select Customer** screen (no login/signup — user picks an existing customer to "act as")
- Place a new order for the selected customer
- Save order + line items into `shop.db`
- Order history page for the selected customer
- Warehouse **Late Delivery Priority Queue** page (top 50)
- **Run Scoring** button — triggers inference job, then refreshes priority queue

---

## Stack Choice
**Recommended: Next.js + SQLite** (best AI agent support)
- Alternatives: FastAPI (Option B) or ASP.NET/C# (Option C) — prompts provided below

---

## Database Contract
- Do NOT invent new tables — use only existing tables: `customers`, `orders`, `order_items`, `products`, `order_predictions`
- `order_predictions` is keyed by `order_id` and written by the pipeline
- If your schema uses different names, update prompts accordingly

---

## Prompts (paste in order, verify after each)

### Prompt 0 — Project Setup (Next.js)
```
You are generating a complete student project web app using Next.js (App Router) and SQLite.
Constraints:
- No authentication. Users select an existing customer to "act as".
- Use a SQLite file named "shop.db" located at the project root (or /data/shop.db if you prefer).
- Use better-sqlite3 for DB access.
- Keep UI simple and clean.

Tasks:
1. Create a new Next.js app (App Router).
2. Add a server-side DB helper module that opens shop.db and exposes helpers for SELECT and INSERT/UPDATE using prepared statements.
3. Create a shared layout with navigation links:
   - Select Customer
   - Customer Dashboard
   - Place Order
   - Order History
   - Warehouse Priority Queue
   - Run Scoring
4. Provide install/run instructions (npm) and any required scripts.

Return:
- All files to create/modify
- Any commands to run
```

---

### Prompt 0.5 — Inspect DB Schema
```
Add a developer-only page at /debug/schema that prints:
- All table names in shop.db
- For each table, the column names and types (PRAGMA table_info)

Purpose: verify the real schema and adjust prompts if needed.
Keep it simple and readable.
```

---

### Prompt 1 — Select Customer Screen
```
Add a "Select Customer" page at /select-customer.

Requirements:
1. Query the database for customers: customer_id, first_name, last_name, email
2. Render a searchable dropdown or simple list. When a customer is selected, store customer_id in a cookie.
3. Redirect to /dashboard after selection.
4. Add a small banner showing the currently selected customer on every page (if set).

Deliver:
- Any new routes/components
- DB query code using better-sqlite3
- Notes on where customer_id is stored
```

---

### Prompt 2 — Customer Dashboard
```
Create a /dashboard page that shows a summary for the selected customer.

Requirements:
1. If no customer is selected, redirect to /select-customer.
2. Show:
   - Customer name and email
   - Total number of orders
   - Total spend across all orders (sum total_value)
   - Table of 5 most recent orders (order_id, order_timestamp, fulfilled, total_value)
3. All data must come from shop.db.

Deliver:
- SQL queries used
- Page UI implementation
```

---

### Prompt 3 — Place Order Page
```
Create a /place-order page that allows creating a new order for the selected customer.

Requirements:
1. If no customer selected, redirect to /select-customer.
2. Query products (product_id, product_name, price) and let the user add 1+ line items: product + quantity.
3. On submit:
   - Insert a row into orders with fulfilled = 0 and order_timestamp = current time
   - Insert corresponding rows into order_items
   - Compute and store total_value in orders (sum price*quantity)
4. After placing, redirect to /orders and show a success message.

Constraints:
- Use a transaction for inserts.
- Keep the UI minimal (a table of line items is fine).

Deliver:
- SQL inserts
- Next.js route handlers (server actions or API routes)
- Any validation rules
```

---

### Prompt 4 — Order History Page
```
Create a /orders page that shows order history for the selected customer.

Requirements:
1. If no customer selected, redirect to /select-customer.
2. Render a table: order_id, order_timestamp, fulfilled, total_value
3. Clicking an order shows /orders/[order_id] with line items: product_name, quantity, unit_price, line_total
4. Keep it clean and readable.

Deliver:
- The two pages
- SQL queries
```

---

### Prompt 5 — Warehouse Priority Queue Page
```
Create /warehouse/priority showing the "Late Delivery Priority Queue".

Use this SQL query exactly (adjust table/column names only if they differ in shop.db):

SELECT
  o.order_id,
  o.order_timestamp,
  o.total_value,
  o.fulfilled,
  c.customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  p.late_delivery_probability,
  p.predicted_late_delivery,
  p.prediction_timestamp
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_predictions p ON p.order_id = o.order_id
WHERE o.fulfilled = 0
ORDER BY p.late_delivery_probability DESC, o.order_timestamp ASC
LIMIT 50;

Requirements:
- Render results in a table.
- Add a short explanation paragraph describing why this queue exists.

Deliver:
- Page code
```

---

### Prompt 6 — Run Scoring Button
```
Add a /scoring page with a "Run Scoring" button.

Behavior:
1. When clicked, the server runs: python jobs/run_inference.py
2. The Python script writes predictions into order_predictions keyed by order_id.
3. The UI shows:
   - Success/failure status
   - How many orders were scored (parse stdout if available)
   - Timestamp

Constraints:
- Safe execution: timeouts and capture stdout/stderr.
- Do not crash if Python fails — show an error message instead.
- Do not require Docker.

Deliver:
- Next.js route/handler for triggering scoring
- Implementation details for running Python from Node
- Any UI components needed
```

---

### Prompt 7 — Polish & Testing Checklist
```
Polish the app for usability and add a testing checklist.

Tasks:
1. Add a banner showing which customer is currently selected.
2. Add basic form validation on /place-order.
3. Add error handling for missing DB, missing tables, or empty results.
4. Provide a manual QA checklist:
   - Select customer
   - Place order
   - View orders
   - Run scoring
   - View priority queue with the new order appearing (after scoring)

Deliver:
- Final code changes
- A README.md with setup and run steps
```

---

## Alternative Stacks

### Option B — Python (FastAPI)
```
Build a complete student web app using Python FastAPI, Jinja2 templates, and SQLite shop.db (at project root).
No authentication: users select an existing customer to "act as".

Pages:
- GET /select-customer: list/search customers and store customer_id in a cookie
- GET /dashboard: summary stats for selected customer
- GET/POST /place-order: select products + quantities and insert orders + order_items
- GET /orders: order history
- GET /orders/{order_id}: order details with line items
- GET /warehouse/priority: priority queue table using order_predictions
- POST /scoring/run: runs python jobs/run_inference.py and then redirects to /warehouse/priority

Constraints:
- Use sqlite3 (no ORM).
- Use transactions for writes.
- Provide minimal CSS.
- Include a README with setup and run instructions (uvicorn).

Deliver all code files and commands.
```

### Option C — ASP.NET / C#
```
Build a complete student web app using ASP.NET Core and SQLite shop.db (at project root).
No authentication: users select an existing customer to "act as" and store customer_id in a cookie.

Pages/Endpoints:
- /select-customer (GET + POST): choose customer
- /dashboard (GET): customer summary + recent orders
- /place-order (GET + POST): create an order and order_items using a DB transaction
- /orders (GET): order history
- /orders/{orderId} (GET): order detail with line items
- /warehouse/priority (GET): late delivery priority queue (join orders/customers/order_predictions)
- /scoring/run (POST): execute python jobs/run_inference.py and return status

Constraints:
- Use Microsoft.Data.Sqlite (no EF required).
- Render simple HTML (Razor Pages or MVC ok).
- Provide commands to run (dotnet run) and setup instructions.

Deliver all code files, NuGet packages, and commands.
```

---

## Key Idea
Operational data → analytics pipeline → trained model → automated scoring → operational workflow improvement.
