import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET() {
  const products = all(
    'SELECT id, name, category, price, stock_qty FROM products WHERE stock_qty > 0 ORDER BY category, name'
  );
  return NextResponse.json(products);
}
