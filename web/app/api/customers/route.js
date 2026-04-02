import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET() {
  const customers = all(
    'SELECT id, name, email, segment FROM customers ORDER BY name'
  );
  return NextResponse.json(customers);
}
