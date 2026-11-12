import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { authorized, database, secretMatches } from '@/lib/server-admin';
import { editorPrompt, parseTrendCandidates } from '@/lib/trend-editor';

export const runtime = 'nodejs';
export const maxDuration = 120;

function kstDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function GET(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: '데이터베이스 설정이 필요합니다.' }, { status: 503 });
  const { data, error } = await db.from('trend_candidates').select('id,title,category,summary,why_now,buzz_score,value_score,source_urls,draft,created_at,production_status,linked_draft_id').order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: '트렌드 후보 테이블을 확인해주세요.' }, { status: 500 });
  return NextResponse.json({ trends: data });
}

// Disabled by request: ChatGPT does the research, not an OpenAI API call from this application.
export async function POST() {
  return NextResponse.json({ error: '서버 AI 트렌드 수집 기능은 사용하지 않습니다. ChatGPT 예약 결과를 관리자 화면에서 가져오세요.' }, { status: 410 });
}
