import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorized, database } from '@/lib/server-admin';
import { MEDIA_BUCKET } from '@/lib/card-media';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  const db = database();
  if (!db) return NextResponse.json({ error: '저장소 연결이 필요합니다.' }, { status: 503 });
  let file: File | null;
  try { file = (await req.formData()).get('file') as File | null; }
  catch { return NextResponse.json({ error: '이미지 파일을 확인해주세요.' }, { status: 400 }); }
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'PNG, JPG, WebP 이미지(최대 8MB)만 업로드할 수 있습니다.' }, { status: 400 });
  }
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const imagePath = `cards/${randomUUID()}.${ext}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(imagePath, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: '이미지 저장에 실패했습니다. Supabase Storage 버킷 설정을 확인해주세요.' }, { status: 500 });
  const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(imagePath, 3600);
  if (!data) return NextResponse.json({ error: '이미지 접근 링크를 만들지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ imagePath, imageUrl: data.signedUrl });
}

/** Return a private uploaded card image to the signed-in editor for lossless PNG capture. */
export async function GET(req: NextRequest) {
  if (!await authorized(req)) return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!/^cards\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path)) return NextResponse.json({ error: '이미지 경로가 올바르지 않습니다.' }, { status: 400 });
  const db = database();
  if (!db) return NextResponse.json({ error: '저장소 연결이 필요합니다.' }, { status: 503 });
  const { data, error } = await db.storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) return NextResponse.json({ error: '이미지를 불러오지 못했습니다.' }, { status: 404 });
  const body = await data.arrayBuffer();
  const contentType = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new NextResponse(body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
