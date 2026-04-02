import { NextResponse } from 'next/server';
import { all, run, transaction } from '@/lib/db';

/*
  Heuristic ML scoring — mimics what a real trained model would return.

  Features used (all derived from order history):
    - recency:    days since last order
    - frequency:  orders per 30 days over account lifetime
    - monetary:   total_amount spent

  Outputs:
    churn_prob    (0.0–1.0)   higher = more likely to churn
    predicted_ltv (dollars)   estimated 12-month lifetime value
    priority_score (0–100)    warehouse serving priority (higher = serve first)
*/

function scoreCustomer(c) {
  const orderCount  = c.order_count  || 0;
  const totalSpent  = c.total_spent  || 0;
  const daysSinceLast = c.days_since_last ?? 999;
  const accountAgeDays = Math.max(1, c.account_age_days || 1);

  // Recency factor (0 = very recent, 1 = very old)
  const recency = Math.min(1, daysSinceLast / 90);

  // Frequency risk (0 = frequent buyer, 1 = never buys)
  const monthlyFreq = (orderCount / accountAgeDays) * 30;
  const freqRisk = Math.max(0, 1 - monthlyFreq / 4);

  // Monetary (average order value, normalized)
  const avgOrder = orderCount > 0 ? totalSpent / orderCount : 0;

  const churn_prob = parseFloat(Math.min(1, recency * 0.55 + freqRisk * 0.45).toFixed(4));

  // LTV: extrapolate monthly spend over 12 months, discounted by churn risk
  const monthly_spend = (totalSpent / accountAgeDays) * 30;
  const predicted_ltv = parseFloat(
    Math.max(0, monthly_spend * 12 * (1 - churn_prob * 0.5) + avgOrder * 2).toFixed(2)
  );

  // Priority: high LTV + high churn risk = serve immediately
  const segBonus = c.segment === 'gold' ? 20 : c.segment === 'silver' ? 10 : 0;
  const priority_score = parseFloat(
    Math.min(100,
      churn_prob * 40          // churny customers need attention
      + Math.min(30, predicted_ltv / 50)  // valuable customers
      + segBonus               // segment bonus
      + Math.min(10, daysSinceLast / 9)   // waiting a long time
    ).toFixed(2)
  );

  return { churn_prob, predicted_ltv, priority_score };
}

export async function POST() {
  const t0 = Date.now();
  try {
    const customers = all(`
      SELECT
        c.id,
        c.name,
        c.segment,
        c.created_at,
        COUNT(o.id)                                        AS order_count,
        COALESCE(SUM(o.total_amount), 0)                   AS total_spent,
        CAST(julianday('now') - julianday(MAX(o.order_date)) AS INTEGER)
                                                           AS days_since_last,
        CAST(julianday('now') - julianday(c.created_at) AS INTEGER)
                                                           AS account_age_days
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
    `);

    const scores = customers.map((c) => {
      const { churn_prob, predicted_ltv, priority_score } = scoreCustomer(c);
      return { ...c, churn_prob, predicted_ltv, priority_score };
    });

    // Persist results
    transaction(() => {
      for (const s of scores) {
        run(
          `INSERT INTO order_predictions
             (customer_id, churn_prob, predicted_ltv, priority_score, scored_at, model_version)
           VALUES (?, ?, ?, ?, datetime('now'), 'heuristic-v1')`,
          s.id, s.churn_prob, s.predicted_ltv, s.priority_score
        );
        // Update customer segment based on predicted LTV + churn
        const newSegment =
          s.predicted_ltv >= 300 && s.churn_prob < 0.4 ? 'gold'
          : s.predicted_ltv >= 100 || s.churn_prob < 0.6 ? 'silver'
          : 'bronze';
        run('UPDATE customers SET segment = ? WHERE id = ?', newSegment, s.id);
      }
    });

    return NextResponse.json({
      customers_scored: scores.length,
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
