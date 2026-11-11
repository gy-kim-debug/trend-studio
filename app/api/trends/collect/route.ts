import { NextRequest } from 'next/server';
import { POST } from '../route';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Vercel Cron invokes GET. Authentication is checked by the shared collector.
export async function GET(req: NextRequest) {
  return POST(req);
}
