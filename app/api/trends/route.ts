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
  const { data, error } = await db.from('trend_candidates').select('id,title,category,summary,why_now,buzz_score,value_score,source_urls,draft,created_at').order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: '트렌드 후보 테이블을 확인해주세요.' }, { status: 500 });
  return NextResponse.json({ trends: data });
}

export async function POST(req: NextRequest) {
  const cronToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secretMatches(cronToken, process.env.CRON_SECRET) && !await authorized(req)) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY를 설정해야 트렌드 수집을 시작할 수 있습니다.' }, { status: 503 });
  const db = database();
  if (!db) return NextResponse.json({ error: '데이터베이스 설정이 필요합니다.' }, { status: 503 });

  const day = kstDay();
  const { data: collected, error: readError } = await db.from('trend_candidates').select('title').eq('collected_on', day).limit(1);
  if (readError) return NextResponse.json({ error: 'trend_candidates 테이블이 필요합니다.' }, { status: 503 });
  if (collected?.length) return NextResponse.json({ error: '오늘 트렌드는 이미 수집되었습니다. 내일 새 후보를 수집합니다.' }, { status: 409 });
  const { data: recent } = await db.from('trend_candidates').select('title').order('created_at', { ascending: false }).limit(25);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TREND_MODEL || 'gpt-6-astra',
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        input: editorPrompt(day, (recent ?? []).map(row => row.title)),
        max_output_tokens: 6500,
      }),
      signal: AbortSignal.timeout(105000),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: '트렌드 검색 시간이 초과되었거나 연결할 수 없습니다.' }, { status: 504 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: `AI 뉴스 검색 실패 (HTTP ${response.status}). API 모델·한도·결제를 확인해주세요.` }, { status: 502 });
  }

  let trends;
  try {
    const result = await response.json();
    const outputs: { type?: string; action?: { sources?: { url?: string }[] }; content?: { type?: string; text?: string; annotations?: { type?: string; url?: string }[] }[] }[] = result.output ?? [];
    const texts = outputs.flatMap(item => item.type === 'message' ? item.content ?? [] : []).filter(item => item.type === 'output_text');
    const cited = new Set([
      ...texts.flatMap(item => item.annotations ?? []).filter(a => a.type === 'url_citation' && a.url?.startsWith('https://')).map(a => a.url!),
      ...outputs.flatMap(item => item.type === 'web_search_call' ? item.action?.sources ?? [] : []).map(item => item.url).filter((url): url is string => Boolean(url?.startsWith('https://'))),
    ]);
    const raw = texts.map(item => item.text ?? '').join('\n').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    trends = parseTrendCandidates(JSON.parse(raw), cited);
  } catch {
    return NextResponse.json({ error: '검색 결과의 출처 또는 카드 원고 검증에 실패했습니다. 요금이 발생했을 수 있으나 잘못된 콘텐츠는 저장하지 않았습니다.' }, { status: 502 });
  }

  const payload = trends.map(trend => ({
    title: trend.title, category: trend.category, summary: trend.summary, why_now: trend.whyNow,
    buzz_score: trend.buzzScore, value_score: trend.valueScore, source_urls: trend.sourceUrls,
    draft: trend.draft, collected_on: day,
    fingerprint: createHash('sha256').update(trend.title.normalize('NFKC').toLowerCase()).digest('hex'),
  }));
  const { data, error } = await db.from('trend_candidates').upsert(payload, { onConflict: 'fingerprint', ignoreDuplicates: true }).select('id,title');
  if (error) return NextResponse.json({ error: '수집 결과 저장에 실패했습니다. Supabase 테이블 설정을 확인해주세요.' }, { status: 500 });
  return NextResponse.json({ collected: data?.length ?? 0, titles: data?.map(item => item.title) ?? [] });
}
