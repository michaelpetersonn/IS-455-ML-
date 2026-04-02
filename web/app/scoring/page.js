'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ScoringPage() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const runScoring = async () => {
    setStatus('running');
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/scoring', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scoring failed');
      setResults(data);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Run Scoring</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>Inference Job</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Calculates <strong>churn probability</strong>, <strong>predicted LTV</strong>, and{' '}
          <strong>priority score</strong> for every customer using their order history.
          Results are written to <code>order_predictions</code> and will update the warehouse queue.
        </p>
        <button
          className="btn btn-primary"
          onClick={runScoring}
          disabled={status === 'running'}
        >
          {status === 'running' ? '⏳ Running…' : '▶ Run Scoring Now'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {status === 'done' && results && (
        <>
          <div className="alert alert-success">
            Scored <strong>{results.customers_scored}</strong> customers in{' '}
            <strong>{results.elapsed_ms}ms</strong>.{' '}
            <Link href="/warehouse">View updated queue →</Link>
          </div>

          <div className="card">
            <h2>Score Summary</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Segment</th>
                    <th>Churn Risk</th>
                    <th>Predicted LTV</th>
                    <th>Priority Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.scores.map((s) => (
                    <tr key={s.customer_id}>
                      <td>{s.name}</td>
                      <td><span className={`badge badge-${s.segment}`}>{s.segment}</span></td>
                      <td style={{ color: s.churn_prob > 0.6 ? 'var(--danger)' : s.churn_prob > 0.3 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        {(s.churn_prob * 100).toFixed(1)}%
                      </td>
                      <td>${s.predicted_ltv.toFixed(2)}</td>
                      <td>{s.priority_score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
