import { NextRequest, NextResponse } from 'next/server';
import { POST as collectTrends } from '../route';
import { produceToday } from '@/lib/production';
import { authorized, secretMatches } from '@/lib/server-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

// One daily Vercel cron first collects trends, then prepares image assets
// and writes review-only drafts. It never publishes on Instagram.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') ?? '';
  if (!secretMatches(token,process.env.CRON_SECRET) && !await authorized(req)) {
    return NextResponse.json({error:'인증이 필요합니다.'},{status:401});
  }
  const collection = await collectTrends(req);
  if (!collection.ok && collection.status !== 409) return collection;
  const production = await produceToday();
  if (production.error) return NextResponse.json(production,{status:503});
  return NextResponse.json({ collectionStatus: collection.status, ...production });
}
