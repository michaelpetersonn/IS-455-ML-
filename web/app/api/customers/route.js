import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET() {
  const customers = await all(
    'SELECT customer_id AS id, full_name AS name, email, loyalty_tier AS segment FROM customers ORDER BY full_name'
  );
  return NextResponse.json(customers);
}
