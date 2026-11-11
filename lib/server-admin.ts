import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

export function secretMatches(actual: string, expected?: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function authorized(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (secretMatches(token, process.env.TREND_STUDIO_API_TOKEN)) return true;
  const email = process.env.TREND_STUDIO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !token) return false;
  const db = database();
  if (!db) return false;
  const { data, error } = await db.auth.getUser(token);
  return !error && Boolean(data.user?.email_confirmed_at) && data.user?.email?.toLowerCase() === email;
}
