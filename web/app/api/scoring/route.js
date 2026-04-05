import { NextResponse } from 'next/server';
import { all, run } from '@/lib/db';

/*
  POST /api/scoring

  Step 1 — Heuristic customer scoring (JS):
    Computes churn_prob, predicted_ltv, priority_score for every customer
    using RFM (recency, frequency, monetary) signals and writes to customer_predictions.

  Step 2 — JS fraud scoring for orders:
    Scores every unfulfilled order using risk_score as a fraud probability proxy
    and writes fraud_probability + predicted_fraud into order_predictions.
    (The full sklearn model in notebook.ipynb / run_inference.py is used locally;
    Vercel runs this JS approximation since Python is not available in serverless.)
*/

function scoreCustomer(c) {
  const orderCount    = c.order_count    || 0;
  const totalSpent    = c.total_spent    || 0;
  const daysSinceLast = c.days_since_last ?? 999;
  const accountAgeDays = Math.max(1, c.account_age_days || 1);

  const recency     = Math.min(1, daysSinceLast / 90);
  const monthlyFreq = (orderCount / accountAgeDays) * 30;
  const freqRisk    = Math.max(0, 1 - monthlyFreq / 4);
  const avgOrder    = orderCount > 0 ? totalSpent / orderCount : 0;

  const churn_prob = parseFloat(Math.min(1, recency * 0.55 + freqRisk * 0.45).toFixed(4));

  const monthly_spend = (totalSpent / accountAgeDays) * 30;
  const predicted_ltv = parseFloat(
    Math.max(0, monthly_spend * 12 * (1 - churn_prob * 0.5) + avgOrder * 2).toFixed(2)
  );

  const segBonus = c.segment === 'gold' ? 20 : c.segment === 'silver' ? 10 : 0;
  const priority_score = parseFloat(
    Math.min(100,
      churn_prob * 40
      + Math.min(30, predicted_ltv / 50)
      + segBonus
      + Math.min(10, daysSinceLast / 9)
    ).toFixed(2)
  );

  return { churn_prob, predicted_ltv, priority_score };
}

export async function POST() {
  const t0 = Date.now();
  try {
    // ── Step 1: Heuristic customer scoring ──────────────────────────────────
    const customers = await all(`
      SELECT
        c.customer_id                                                                AS id,
        c.full_name                                                                  AS name,
        c.loyalty_tier                                                               AS segment,
        c.created_at,
        COUNT(o.order_id)                                                            AS order_count,
        COALESCE(SUM(o.order_total), 0)                                              AS total_spent,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(o.order_datetime)::timestamp)) / 86400)::integer
                                                                                     AS days_since_last,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - c.created_at::timestamp)) / 86400)::integer
                                                                                     AS account_age_days
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.customer_id
      GROUP BY c.customer_id, c.full_name, c.loyalty_tier, c.created_at
    `);

    const scores = customers.map((c) => {
      const { churn_prob, predicted_ltv, priority_score } = scoreCustomer(c);
      return { ...c, churn_prob, predicted_ltv, priority_score };
    });

    for (const s of scores) {
      await run(
        `INSERT INTO customer_predictions
           (customer_id, churn_prob, predicted_ltv, priority_score, scored_at, model_version)
         VALUES ($1, $2, $3, $4, NOW()::text, 'heuristic-v1')`,
        s.id, s.churn_prob, s.predicted_ltv, s.priority_score
      );
      const newTier =
        s.predicted_ltv >= 300 && s.churn_prob < 0.4 ? 'gold'
        : s.predicted_ltv >= 100 || s.churn_prob < 0.6 ? 'silver'
        : 'none';
      await run(
        'UPDATE customers SET loyalty_tier = $1 WHERE customer_id = $2',
        newTier, s.id
      );
    }

    // ── Step 2: JS fraud scoring for unfulfilled orders ──────────────────────
    const orders = await all(
      'SELECT order_id, risk_score FROM orders WHERE fulfilled = 0'
    );

    for (const o of orders) {
      const fraudProb = Math.min(0.99, Number(o.risk_score) / 100);
      await run(
        `INSERT INTO order_predictions (order_id, fraud_probability, predicted_fraud, prediction_timestamp)
         VALUES ($1, $2, $3, NOW()::text)
         ON CONFLICT (order_id) DO UPDATE SET
           fraud_probability    = EXCLUDED.fraud_probability,
           predicted_fraud      = EXCLUDED.predicted_fraud,
           prediction_timestamp = EXCLUDED.prediction_timestamp`,
        o.order_id, fraudProb, fraudProb > 0.5 ? 1 : 0
      );
    }

    return NextResponse.json({
      customers_scored: scores.length,
      orders_scored: orders.length,
      elapsed_ms: Date.now() - t0,
      scores: scores.map(({ id, name, segment, churn_prob, predicted_ltv, priority_score }) => ({
        customer_id: id,
        name,
        segment,
        churn_prob,
        predicted_ltv,
        priority_score,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
