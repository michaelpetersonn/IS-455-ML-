'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function selectCustomerAction(formData) {
  const customerId = formData.get('customer_id');
  if (!customerId) return;
  const cookieStore = await cookies();
  cookieStore.set('customer_id', String(customerId), {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  });
  redirect('/dashboard');
}
