import { NextRequest, NextResponse } from 'next/server';
import { parseCardDraft } from '@/lib/content';
import { authorized, database } from '@/lib/server-admin';
import { signedSlides } from '@/lib/card-media';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: 'Supabase 연결 설정이 필요합니다.' }, { status: 503 });
  const { data, error } = await db.from('card_drafts').select('id,title,category,brand,source_urls,slides,caption,hashtags,status,created_at,trend_id,publish_status,published_at').order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: '초안 목록을 불러오지 못했습니다.' }, { status: 500 });
  const drafts = await Promise.all((data ?? []).map(async draft => ({ ...draft, slides: await signedSlides(draft.slides) })));
  return NextResponse.json({ drafts });
}

export async function POST(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: 'Supabase 연결 설정이 필요합니다.' }, { status: 503 });
  let input: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 20000) return NextResponse.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    input = JSON.parse(raw);
  } catch { return NextResponse.json({ error: '유효한 JSON이 필요합니다.' }, { status: 400 }); }
  const trendId = input && typeof input === 'object' && 'trendId' in input && typeof input.trendId === 'string' ? input.trendId : null;
  if (trendId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trendId)) return NextResponse.json({ error: '트렌드 ID 형식이 올바르지 않습니다.' }, { status: 400 });
  if (trendId) {
    const { data: trend, error: trendError } = await db.from('trend_candidates').select('id,production_status,linked_draft_id').eq('id',trendId).maybeSingle();
    if (trendError || !trend) return NextResponse.json({ error: '연결할 트렌드가 없습니다.' }, { status: 404 });
    if (trend.linked_draft_id) return NextResponse.json({ error: '이미 제작된 트렌드입니다. 내 게시글에서 기존 원고를 수정하세요.' }, { status: 409 });
  }
  let draft;
  try { draft = parseCardDraft(input); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '입력 오류' }, { status: 400 }); }
  const { data, error } = await db.from('card_drafts').insert({ title: draft.title, category: draft.category, brand: draft.brand, source_urls: draft.sourceUrls, slides: draft.slides.map(({ imageUrl: _url, ...slide }) => slide), caption: draft.caption ?? '', hashtags: draft.hashtags ?? '', trend_id: trendId }).select('id,created_at').single();
  if (error) return NextResponse.json({ error: '초안을 저장하지 못했습니다.' }, { status: 500 });
  if (trendId) {
    const { error: linkError } = await db.from('trend_candidates').update({ production_status: 'completed', linked_draft_id: data.id }).eq('id', trendId).is('linked_draft_id', null).select('id').single();
    if (linkError) return NextResponse.json({ error: '게시글은 저장됐지만 트렌드 상태 연결에 실패했습니다. 관리자에게 확인해주세요.', draftId: data.id }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, createdAt: data.created_at, status: 'draft' }, { status: 201 });
}

const statuses = ['review', 'ready', 'published', 'held'] as const;

export async function PATCH(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: 'Supabase 연결 설정이 필요합니다.' }, { status: 503 });

  let input: { id?: unknown; publishStatus?: unknown; draft?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '유효한 JSON이 필요합니다.' }, { status: 400 }); }
  const id = input.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    return NextResponse.json({ error: '게시글 ID 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  // Content edits and publication-status transitions are separate operations.
  if (input.draft !== undefined) {
    if (input.publishStatus !== undefined) return NextResponse.json({ error: '원고와 게시 상태는 각각 저장해주세요.' }, { status: 400 });
    let draft;
    try { draft = parseCardDraft(input.draft); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '원고 형식 오류' }, { status: 400 }); }
    const { data, error } = await db.from('card_drafts').update({
      title: draft.title,
      category: draft.category,
      brand: draft.brand,
      source_urls: draft.sourceUrls,
      slides: draft.slides.map(({ imageUrl: _url, ...slide }) => slide),
      caption: draft.caption ?? '',
      hashtags: draft.hashtags ?? '',
    }).eq('id', id).select('id,publish_status').maybeSingle();
    if (error) return NextResponse.json({ error: '변경사항을 저장하지 못했습니다.' }, { status: 500 });
    if (!data) return NextResponse.json({ error: '수정할 게시글을 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ id: data.id, publishStatus: data.publish_status });
  }

  const next = input.publishStatus;
  if (!statuses.some(status => status === next)) return NextResponse.json({ error: '게시 상태가 올바르지 않습니다.' }, { status: 400 });
  const { data: existing, error: readError } = await db.from('card_drafts').select('publish_status').eq('id', id).maybeSingle();
  if (readError || !existing) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  if (next === 'published' && existing.publish_status !== 'ready') return NextResponse.json({ error: '먼저 게시 준비 완료로 표시해주세요.' }, { status: 409 });
  const { data, error } = await db.from('card_drafts').update({ publish_status: next, published_at: next === 'published' ? new Date().toISOString() : null }).eq('id', id).select('id,publish_status,published_at').single();
  if (error) return NextResponse.json({ error: '게시 상태를 저장하지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ draft: data });
}
