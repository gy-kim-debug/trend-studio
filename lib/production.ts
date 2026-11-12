import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { database } from '@/lib/server-admin';
import type { CardDraft, Slide } from '@/lib/content';

type Candidate = { id: string; title: string; draft: CardDraft; production_status: string };
type Prepared = { slide: Slide; attribution?: string; ready: boolean };

function plain(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function metadata(value: unknown): string {
  return value && typeof value === 'object' && 'value' in value ? String((value as {value: unknown}).value) : '';
}
function matchesTopic(title: string, query: string): boolean {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !['image', 'photo', 'press', 'official', 'product', 'collaboration'].includes(word));
  const candidate = title.toLowerCase();
  return words.some(word => candidate.includes(word));
}
type CommonsPage = {
  title?: string;
  imageinfo?: { url?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, unknown> }[];
};
async function licensedPhoto(query: string): Promise<{bytes: Buffer; contentType: string; attribution: string} | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
    gsrsearch: query.slice(0, 110), gsrlimit: '12', prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
  });
  const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params, {
    headers: { 'User-Agent': 'TrendStudio/1.0 (licensed-media search)' },
    signal: AbortSignal.timeout(11000), cache: 'no-store'
  });
  if (!response.ok) return null;
  const result = await response.json();
  const pages: CommonsPage[] = Object.values(result?.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = plain(metadata(meta.LicenseShortName));
    const licenseUrl = plain(metadata(meta.LicenseUrl));
    const reusable = /^(CC0|CC BY(?:-SA)?(?:\s|$)|Public domain|PD)/i.test(license)
      && !/NC|ND/i.test(license) && (!licenseUrl || licenseUrl.startsWith('https://'));
    if (!reusable || !matchesTopic(page.title ?? '', query)) continue;
    if (!info?.url?.startsWith('https://upload.wikimedia.org/') || !['image/jpeg','image/png','image/webp'].includes(info.mime ?? '')) continue;
    const photo = await fetch(info.url, { signal: AbortSignal.timeout(13000), cache: 'no-store' });
    if (!photo.ok || Number(photo.headers.get('content-length') || 0) > 8_000_000) continue;
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (bytes.length > 8_000_000 || bytes.length < 1024) continue;
    const author = plain(metadata(meta.Artist)) || 'Wikimedia Commons contributor';
    const attribution = [author, license, info.descriptionurl ?? '', licenseUrl].filter(Boolean).join(' · ');
    return { bytes, contentType: info.mime!, attribution };
  }
  return null;
}
async function aiVisual(prompt: string): Promise<{bytes: Buffer; contentType: string} | null> {
  if (!process.env.OPENAI_API_KEY || !prompt.trim()) return null;
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5',
      prompt: 'Original editorial conceptual illustration for a Korean Instagram news card. Do not create real product photographs, recognizable logos, or misleading documentation. No words or letters. ' + prompt.slice(0, 1000),
      size: '1024x1536', quality: 'low', n: 1, output_format: 'jpeg', output_compression: 80
    }),
    signal: AbortSignal.timeout(105000), cache: 'no-store'
  });
  if (!response.ok) throw new Error('AI image API HTTP ' + response.status);
  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') throw new Error('AI 이미지 데이터 없음');
  const bytes = Buffer.from(b64, 'base64');
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('AI 이미지 파일 용량 오류');
  return {bytes, contentType: 'image/jpeg'};
}
async function upload(db: SupabaseClient, bytes: Buffer, contentType: string): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = 'cards/' + randomUUID() + '.' + ext;
  const { error } = await db.storage.from('trend-card-images').upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error('이미지 업로드 실패: ' + error.message);
  return path;
}
async function prepareSlide(db: SupabaseClient, slide: Slide): Promise<Prepared> {
  const mode = slide.imageMode ?? 'none';
  if (mode === 'none' || slide.layout === 'text' || slide.imagePath) return {slide, ready: true};
  try {
    if (mode === 'official_image') {
      // A page being official does not by itself grant rights to republish its photos.
      // Only automatically attach matched, explicitly reusable Commons files.
      const photo = await licensedPhoto(slide.imagePrompt || slide.title);
      if (!photo) return { slide: {...slide, imageNote: '재사용 허가된 실제 사진을 찾지 못했습니다. 공식 출처와 이미지 이용 허락 확인 필요. ' + (slide.imageNote ?? '')}, ready: false };
      return {slide: {...slide, imagePath: await upload(db, photo.bytes, photo.contentType), imageNote: ('실제 사진 · ' + photo.attribution).slice(0,500)}, attribution: photo.attribution, ready: true};
    }
    if (mode === 'ai_concept') {
      const photo = await aiVisual(slide.imagePrompt || slide.title);
      if (!photo) return {slide: {...slide, imageNote: 'AI 이미지 자동 생성 설정 확인 필요. ' + (slide.imageNote ?? '')}, ready: false};
      return {slide: {...slide, imagePath: await upload(db, photo.bytes, photo.contentType), imageNote: 'AI 생성 콘셉트 이미지 · 실제 현장/제품 사진 아님'}, ready: true};
    }
  } catch (error) {
    console.error('Media preparation failed:', error instanceof Error ? error.message : String(error));
  }
  return {slide: {...slide, imageNote: ('자동 이미지 준비 실패 · ' + (slide.imageNote ?? '')).slice(0,500)}, ready: false};
}
async function produceOne(db: SupabaseClient, item: Candidate) {
  const {data: claimed, error: claimError} = await db.from('trend_candidates')
    .update({production_status: 'in_progress'})
    .eq('id', item.id).eq('production_status', 'unmade').is('linked_draft_id', null)
    .select('id').maybeSingle();
  if (claimError || !claimed) return {title:item.title,status:'skipped'};
  try {
    const source = item.draft;
    const slides: Slide[] = [];
    const credits: string[] = [];
    let missing = 0;
    let ready = 0;
    // Limit paid image generations and external downloads per story.
    let attempted = 0;
    for (const slide of source.slides) {
      const wantsImage = slide.layout !== 'text' && slide.imageMode && slide.imageMode !== 'none';
      if (!wantsImage || attempted >= 2) {
        slides.push(wantsImage ? {...slide, imageNote: '추가 이미지 수동 검토 필요 · ' + (slide.imageNote ?? '')} : slide);
        if (wantsImage) missing++;
        continue;
      }
      attempted++;
      const made = await prepareSlide(db, slide);
      slides.push(made.slide);
      if (!made.ready) missing++; else if (made.slide.imagePath) ready++;
      if (made.attribution) credits.push(made.attribution);
    }
    let caption = source.caption ?? '';
    if (slides.some(s => s.imagePath && s.imageMode === 'ai_concept') && !caption.includes('AI 생성')) {
      caption += '\n\n이미지: AI 생성 콘셉트 이미지';
    }
    if (credits.length) caption += '\n\n이미지 출처: ' + credits.join(' / ');
    const {data: row, error} = await db.from('card_drafts').insert({
      title: source.title, category: source.category, brand: source.brand,
      source_urls: source.sourceUrls,
      slides: slides.map(({imageUrl: _signed, ...slide}) => slide),
      caption: caption.slice(0,2200), hashtags: source.hashtags ?? '', trend_id: item.id
    }).select('id').single();
    if (error || !row) throw new Error(error?.message || '초안 저장 실패');
    const {error: linkError} = await db.from('trend_candidates').update({production_status:'completed', linked_draft_id:row.id}).eq('id',item.id);
    if (linkError) throw new Error('초안 연결 실패: ' + linkError.message);
    return {title:item.title,status:'draft_saved',draftId:row.id,imagesReady:ready,imagesPending:missing};
  } catch (error) {
    const {data: existing} = await db.from('card_drafts').select('id').eq('trend_id',item.id).maybeSingle();
    if (existing) {
      await db.from('trend_candidates').update({production_status:'completed',linked_draft_id:existing.id}).eq('id',item.id);
      return {title:item.title,status:'draft_saved',draftId:existing.id};
    }
    await db.from('trend_candidates').update({production_status:'failed'}).eq('id',item.id);
    console.error('Trend production error:', item.id, error instanceof Error ? error.message : String(error));
    return {title:item.title,status:'failed',error:error instanceof Error ? error.message.slice(0,180) : '알 수 없는 오류'};
  }
}
export async function produceToday(): Promise<{results: unknown[]; error?: string}> {
  const db = database();
  if (!db) return {results:[],error:'Supabase 서버 연결 없음'};
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {data, error} = await db.from('trend_candidates').select('id,title,draft,production_status')
    .eq('collected_on',day).eq('production_status','unmade').is('linked_draft_id',null).limit(3);
  if (error) return {results:[],error:'트렌드 조회 실패'};
  const result = await Promise.all((data ?? []).map(item => produceOne(db,item as Candidate)));
  return {results:result};
}
