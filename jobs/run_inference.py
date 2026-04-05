"""
run_inference.py — Score all unfulfilled orders for fraud and write results to order_predictions.

Usage:
    python jobs/run_inference.py

Expects:
    - shop.db at the project root (one level up from this file)
    - jobs/model.pkl trained by the notebook

Outputs to stdout (parsed by the web app):
    SCORED: <n>
"""

import sys
import sqlite3
import pathlib
import datetime
import joblib
import pandas as pd

ROOT = pathlib.Path(__file__).parent.parent
DB_PATH = ROOT / 'shop.db'
MODEL_PATH = ROOT / 'jobs' / 'model.sav'

CATEGORICAL_FEATURES = [
    'payment_method',
    'device_type',
    'customer_segment',
    'loyalty_tier',
]

NUMERIC_FEATURES = [
    'order_total',
    'promo_used',
    'risk_score',
]

FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


def main():
    if not MODEL_PATH.exists():
        print('ERROR: model.pkl not found. Run the notebook first.', file=sys.stderr)
        sys.exit(1)

    model = joblib.load(MODEL_PATH)

    con = sqlite3.connect(DB_PATH)

    # Ensure order_predictions table exists with correct columns
    con.execute("""
        CREATE TABLE IF NOT EXISTS order_predictions (
            order_id              INTEGER PRIMARY KEY,
            fraud_probability     REAL,
            predicted_fraud       INTEGER,
            prediction_timestamp  TEXT
        )
    """)
    con.commit()

    df = pd.read_sql_query("""
        SELECT
            o.order_id,
            o.payment_method,
            o.device_type,
            o.promo_used,
            o.order_total,
            o.risk_score,
            c.customer_segment,
            c.loyalty_tier
        FROM orders o
        JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.fulfilled = 0
    """, con)

    if df.empty:
        print('SCORED: 0')
        con.close()
        return

    df['customer_segment'] = df['customer_segment'].fillna('unknown')
    df['loyalty_tier'] = df['loyalty_tier'].fillna('none')

    X = df[FEATURES]
    probs = model.predict_proba(X)[:, 1]
    preds = model.predict(X)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cur = con.cursor()
    cur.executemany("""
        INSERT INTO order_predictions (order_id, fraud_probability, predicted_fraud, prediction_timestamp)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(order_id) DO UPDATE SET
            fraud_probability    = excluded.fraud_probability,
            predicted_fraud      = excluded.predicted_fraud,
            prediction_timestamp = excluded.prediction_timestamp
    """, [
        (int(row.order_id), round(float(prob), 4), int(pred), now)
        for row, prob, pred in zip(df.itertuples(), probs, preds)
    ])

    con.commit()
    con.close()

    print(f'SCORED: {len(df)}')


if __name__ == '__main__':
    main()
