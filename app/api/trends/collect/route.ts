import { NextRequest, NextResponse } from 'next/server';
import { POST as collectTrends } from '../route';
import { produceToday } from '@/lib/production';
import { authorized, secretMatches } from '@/lib/server-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function runPipeline(req: NextRequest) {
  const collection = await collectTrends(req);
  if (!collection.ok && collection.status !== 409) {
    const body = await collection.json().catch(() => ({}));
    return NextResponse.json({
      stage: 'trend_collection',
      error: body.error ?? '트렌드 수집 실패',
    }, { status: collection.status });
  }
  const collectionBody = collection.status === 409 ? null : await collection.json().catch(() => null);
  const production = await produceToday();
  if (production.error) return NextResponse.json({stage:'draft_production', ...production}, {status:503});
  return NextResponse.json({
    collectionStatus: collection.status,
    collected: collectionBody?.collected ?? 0,
    message: production.results.length ? '각 카드의 이미지 준비·저장 결과를 확인하세요.' : '오늘 제작 대상이 없습니다. 기존 게시글을 확인하세요.',
    ...production,
  });
}

// Scheduled Vercel cron; requires the configured cron secret.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secretMatches(token, process.env.CRON_SECRET)) return NextResponse.json({error:'예약 실행 인증 실패'}, {status:401});
  return runPipeline(req);
}

// Manual administrator action; uses the existing Supabase session authorization.
export async function POST(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({error:'관리자 인증이 필요합니다.'}, {status:401});
  return runPipeline(req);
}
