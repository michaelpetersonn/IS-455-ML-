import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET() {
  const products = await all(
    'SELECT product_id AS id, product_name AS name, category, price, 999 AS stock_qty FROM products WHERE is_active = 1 ORDER BY category, product_name'
  );
  return NextResponse.json(products);
}
