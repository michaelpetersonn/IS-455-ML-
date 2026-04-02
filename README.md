# ML Pipeline

## Structure
- `data/` — datasets
- `functions/` — reusable Python modules
- `notebook.ipynb` — main analysis and pipeline notebook
# IS-455-ML-


# Project Instructions
Goal
In this chapter, you built a realistic ML pipeline that reads from a live operational database, creates an analytical “warehouse” table for modeling, trains a model, saves a model artifact, generates predictions, and writes those predictions back to the operational database.

In this section, you will vibe code a complete (but simple) web app on top of that database. You will use an AI coding agent (Cursor or Claude Code) to generate most of the application scaffolding. Your job is to (1) provide clear requirements, (2) keep the database contract stable, and (3) test the application until it matches expected behavior.

To keep scope manageable, this app intentionally ignores authentication. Instead, it lets the user select an existing customer to “act as” during testing.

What Your App Must Do
Use an existing SQLite database file named shop.db (operational DB).
Provide a “Select Customer” screen (no signup/login).
Allow placing a new order for the selected customer.
Save the order + line items into shop.db.
Show an order history page for that customer.
Show the warehouse “Late Delivery Priority Queue” page (top 50).
Provide a “Run Scoring” button that triggers the inference job and then refreshes the priority queue.
You will build the app in one of three stacks. The recommended default is JavaScript (Next.js) because it is widely supported by AI coding agents and has a straightforward developer experience.

Database Contract
Your AI agent must not invent new tables. It should only use the operational database tables you already have (for example, customers, orders, order_items, products, and order_predictions). If your database uses different table or column names, update the prompts below to match your schema.

The pipeline writes predictions into order_predictions keyed by order_id. The application should treat that table like any other application table.

Recommended Stack
For students with limited background, use: Next.js + SQLite for the web app, and a separate Python inference script that writes predictions into the database.

The rest of this section provides a complete sequence of copy/paste prompts. Paste them into Cursor (or Claude Code) in order. After each step, run the app and verify behavior before moving on.


