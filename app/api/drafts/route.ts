import { NextRequest, NextResponse } from 'next/server';
import { parseCardDraft } from '@/lib/content';
import { authorized, database } from '@/lib/server-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: 'Supabase 연결 설정이 필요합니다.' }, { status: 503 });
  const { data, error } = await db.from('card_drafts').select('id,title,category,brand,source_urls,slides,status,created_at').order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: '초안 목록을 불러오지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ drafts: data });
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
  let draft;
  try { draft = parseCardDraft(input); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '입력 오류' }, { status: 400 }); }
  const { data, error } = await db.from('card_drafts').insert({ title: draft.title, category: draft.category, brand: draft.brand, source_urls: draft.sourceUrls, slides: draft.slides }).select('id,created_at').single();
  if (error) return NextResponse.json({ error: '초안을 저장하지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ id: data.id, createdAt: data.created_at, status: 'draft' }, { status: 201 });
}
