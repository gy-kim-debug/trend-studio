'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, FileJson, Images, Layers3, LockKeyhole, LogOut, RotateCcw, Share2, Sparkles, TrendingUp, ExternalLink, Newspaper, CalendarDays, PencilLine, RefreshCw, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { CardDraft, normalizeHashtags, parseCardDraft, parseImportBundle, Slide } from '@/lib/content';

type Theme = 'midnight' | 'paper' | 'citrus';
type ShareKind = 'one' | 'all';
type PreparedShare = { kind: ShareKind; signature: string; files: File[] };
type RenderedPreview = { signature: string; url: string; blob: Blob };
type TrendRow = { id: string; title: string; category: string; summary: string; why_now: string; buzz_score: number; value_score: number; source_urls: string[]; draft: CardDraft; created_at: string; production_status?: 'unmade' | 'in_progress' | 'completed' | 'failed'; linked_draft_id?: string | null };
type StudioView = 'trends' | 'drafts' | 'editor';
type PublishStatus = 'review' | 'ready' | 'published' | 'held';
const publishLabels: Record<PublishStatus,string> = { review: '검토 대기', ready: '게시 준비', published: '게시 완료', held: '보류' };

const koreanDate = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));

const initialSlides: Slide[] = [
  { kicker: 'AI BREAKTHROUGH', title: 'AI가 보안 코드의 안전성을 증명했다고?', body: '우리가 사용하는 암호화 기술을 검증하는 새로운 방법이 등장했습니다.' },
  { kicker: 'WHAT HAPPENED', title: '무슨 일이 있었을까?', body: '구글 딥마인드가 AI 에이전트를 활용해 Signal 암호화 프로토콜 코드의 핵심 보안 속성을 수학적으로 검증했다고 발표했습니다.' },
  { kicker: 'WHY IT MATTERS', title: '기존 보안 검사와 뭐가 다를까?', body: '일반적인 테스트는 특정 상황의 오류를 확인합니다. 형식 검증은 코드가 정해진 조건을 만족한다는 사실을 수학적으로 증명합니다.' },
  { kicker: 'THE IMPACT', title: '왜 주목할 만할까?', body: '딥마인드는 약 4주에 걸쳐 검증을 수행했다고 설명했습니다. AI가 복잡한 소프트웨어의 신뢰성을 검증하는 데 활용될 가능성을 보여줍니다.' },
  { kicker: 'TAKEAWAY', title: '이제 해킹 걱정은 끝?', body: '아직은 아닙니다. 이번 성과는 특정 보안 속성을 검증한 결과이지 모든 취약점이 사라졌다는 뜻은 아닙니다.' },
];

const themes: { id: Theme; name: string; description: string; colors: string[] }[] = [
  { id: 'midnight', name: 'Midnight', description: '선명하고 강렬한 뉴스', colors: ['#101b32', '#78abff', '#e9eef9'] },
  { id: 'paper', name: 'Editorial', description: '차분한 매거진 무드', colors: ['#eee9dd', '#172641', '#ba6244'] },
  { id: 'citrus', name: 'Citrus', description: '경쾌한 트렌드 브리핑', colors: ['#dbf66d', '#16221d', '#ff886a'] },
];

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminClient: SupabaseClient | null = authUrl && authKey
  ? createClient(authUrl, authKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

function Card({ slide, index, total, theme, brand, capture = false }: { slide: Slide; index: number; total: number; theme: Theme; category: string; brand: string; capture?: boolean }) {
  const visual = Boolean(slide.imageUrl && slide.layout !== 'text');
  const backgroundCover = visual && index === 0 && slide.layout === 'background';
  return (
    <article className={`news-card theme-${theme} ${index === 0 ? 'cover-card' : 'body-card'} ${visual ? `visual-card visual-${slide.layout}` : ''} ${backgroundCover ? 'cover-background' : ''}`} data-capture={capture ? 'true' : undefined}>
      <div className="card-shape shape-one" /><div className="card-shape shape-two" />
      <div className="card-top" style={{ justifyContent: 'flex-end' }}><span className="card-number">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span></div>
      {visual && <div className="card-media"><img src={slide.imageUrl} alt="카드에 첨부한 이미지" crossOrigin="anonymous" style={{ objectFit: backgroundCover ? 'cover' : (slide.imageFit ?? 'contain') }} /></div>}
      <div className="card-content">
        <div className="card-rule" /><p className="card-kicker">{slide.kicker || 'THE STORY'}</p>
        <h2>{slide.title || '제목을 입력하세요'}</h2>
        <p className="card-body">{slide.body || '본문을 입력하세요.'}</p>
      </div>
      <div className="card-bottom"><span>{brand || 'TREND STUDIO'}</span><span className="card-arrow">↗</span></div>
    </article>
  );
}

export default function Studio() {
  const [view, setView] = useState<StudioView>('trends');
  const [dateFilter, setDateFilter] = useState('all');
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState<Theme>('midnight');
  const [category, setCategory] = useState('TECH / AI');
  const [brand, setBrand] = useState('TREND BRIEF');
  const [busy, setBusy] = useState(false);
  const [preparedShare, setPreparedShare] = useState<PreparedShare | null>(null);
  const [renderedPreview, setRenderedPreview] = useState<RenderedPreview | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [remoteDrafts, setRemoteDrafts] = useState<{ id: string; title: string; category: string; brand: string; source_urls: string[]; slides: Slide[]; caption: string; hashtags: string; trend_id?: string | null; publish_status: PublishStatus; published_at?: string | null }[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [trendRows, setTrendRows] = useState<TrendRow[]>([]);
  const [sourceTrendId, setSourceTrendId] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('review');
  const [publishBusy, setPublishBusy] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [storyTitle, setStoryTitle] = useState('AI가 보안 코드의 안전성을 증명했다고?');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const captureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shareSignature = JSON.stringify({ slides, selected, theme, category, brand });

  useEffect(() => () => { if (renderedPreview) URL.revokeObjectURL(renderedPreview.url); }, [renderedPreview]);

  useEffect(() => {
    if (!adminClient) { setAuthChecking(false); return; }
    let active = true;
    adminClient.auth.getUser().then(({ data }) => {
      if (active) { setSignedInEmail(data.user?.email ?? ''); setAuthChecking(false); }
    }).catch(() => { if (active) setAuthChecking(false); });
    const { data: listener } = adminClient.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedInEmail(session?.user.email ?? '');
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!signedInEmail) return;
    if (view === 'trends' && !trendsLoaded && !loadingTrends) void fetchTrends();
    if (view === 'drafts' && !draftsLoaded && !loadingDrafts) void fetchDrafts();
    // Reloads are requested explicitly by the refresh controls after first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInEmail, view, trendsLoaded, draftsLoaded]);

  async function loginAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminClient) { setNotice('관리자 로그인 환경변수 설정이 필요합니다.'); return; }
    setAuthBusy(true);
    try {
      const { error } = await adminClient.auth.signInWithPassword({ email: adminEmail.trim(), password: adminPassword });
      if (error) throw error;
      setAdminPassword('');
      setNotice('로그인했습니다. 이제 저장된 초안을 조회하거나 새 초안을 저장할 수 있습니다.');
    } catch { setNotice('로그인에 실패했습니다. 이메일, 비밀번호 또는 계정 권한을 확인해주세요.'); }
    finally { setAuthBusy(false); }
  }

  async function logoutAdmin() {
    await adminClient?.auth.signOut();
    setRemoteDrafts([]);
    setTrendRows([]); setTrendsLoaded(false); setDraftsLoaded(false); setView('trends');
    setNotice('관리자 로그아웃했습니다.');
  }

  async function updateAdminPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminClient || newPassword.length < 12) { setNotice('비밀번호는 12자 이상으로 설정해주세요.'); return; }
    setAuthBusy(true);
    const { error } = await adminClient.auth.updateUser({ password: newPassword });
    setAuthBusy(false);
    if (error) { setNotice('비밀번호 설정에 실패했습니다. 다시 시도해주세요.'); return; }
    setNewPassword(''); setShowPasswordUpdate(false);
    setNotice('비밀번호를 설정했습니다. 이제 관리자 계정으로 로그인할 수 있습니다.');
  }

  async function authHeader(): Promise<Record<string, string>> {
    if (!adminClient) throw new Error('관리자 로그인 설정이 필요합니다.');
    const { data, error } = await adminClient.auth.getSession();
    if (error || !data.session) throw new Error('관리자 로그인이 필요합니다.');
    return { Authorization: `Bearer ${data.session.access_token}` };
  }

  const updateSlide = (key: keyof Slide, value: string) => setSlides(current => current.map((slide, i) => i === selected ? { ...slide, [key]: value } : slide));
  const addSlide = () => { if (slides.length >= 8) return; setSlides(current => [...current, { kicker: 'NEXT TREND', title: '새 카드 제목', body: '전달할 핵심 내용을 입력하세요.', layout: 'text' }]); setSelected(slides.length); };
  const removeSlide = () => { if (slides.length <= 4) return; setSlides(current => current.filter((_, i) => i !== selected)); setSelected(i => Math.max(0, Math.min(i, slides.length - 2))); };
  async function uploadImage(file?: File) {
    if (!file) return;
    setUploadBusy(true); setNotice('이미지 업로드 중...');
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/media', { method: 'POST', headers: await authHeader(), body: form });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? '업로드 실패');
      setSlides(current => current.map((slide, i) => i === selected ? { ...slide, imagePath: result.imagePath, imageUrl: result.imageUrl, layout: slide.layout === 'text' || !slide.layout ? 'image' : slide.layout } : slide));
      setNotice('이미지가 추가되었습니다. 카드 레이아웃을 선택해주세요.');
    } catch (error) { setNotice(`이미지 업로드 실패: ${error instanceof Error ? error.message : '오류'}`); }
    finally { setUploadBusy(false); }
  }
  const fileName = (i: number) => `trend-studio-${String(i + 1).padStart(2, '0')}.png`;

  function applyDraft(draft: CardDraft, trendId: string | null = null, savedId: string | null = null, savedStatus: PublishStatus = 'review') {
    setSourceTrendId(trendId); setCurrentDraftId(savedId); setPublishStatus(savedStatus);
    setSlides(draft.slides); setCategory(draft.category); setBrand(draft.brand);
    setSourceUrls(draft.sourceUrls); setStoryTitle(draft.title); setCaption(draft.caption ?? ''); setHashtags(normalizeHashtags(draft.hashtags ?? '')); setSelected(0);
    setView('editor');
    setNotice('콘텐츠를 불러왔습니다. 게시 전 사실 관계를 검토해주세요.');
  }

  function importJson() {
    try { applyDraft(parseImportBundle(JSON.parse(cleanJsonText()))[0]); setShowImport(false); }
    catch (error) { setNotice(`가져오기 실패: ${error instanceof Error ? error.message : '잘못된 JSON'}`); }
  }

  const cleanJsonText = () => jsonText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  async function importAndSaveAll() {
    if (!signedInEmail) { setNotice('여러 원고를 저장하려면 관리자 로그인이 필요합니다.'); return; }
    let drafts: CardDraft[];
    try { drafts = parseImportBundle(JSON.parse(cleanJsonText())); }
    catch (error) { setNotice(`검증 실패: ${error instanceof Error ? error.message : '잘못된 JSON'}`); return; }
    setImportBusy(true);
    let saved = 0;
    try {
      const headers = { ...await authHeader(), 'Content-Type': 'application/json' };
      for (const draft of drafts) {
        const response = await fetch('/api/drafts', { method: 'POST', headers, body: JSON.stringify(draft) });
        const result = await response.json();
        if (!response.ok) throw new Error(`${draft.title}: ${result.error ?? '저장 실패'}`);
        saved++;
      }
      setDraftsLoaded(false); setView('drafts'); setShowImport(false);
      setNotice(`${saved}개 검토용 초안을 저장했습니다. 이미지 제안은 카드별로 확인해주세요.`);
    } catch (error) { setNotice(`${saved}개 저장 후 중단: ${error instanceof Error ? error.message : '오류'}`); }
    finally { setImportBusy(false); }
  }

  function exportJson() {
    const data: CardDraft = { title: storyTitle, category, brand, sourceUrls, slides: slides.map(({ imageUrl: _url, ...slide }) => slide), caption, hashtags: normalizeHashtags(hashtags) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    download(url, 'trend-studio-draft.json');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function fetchDrafts() {
    setLoadingDrafts(true);
    try {
      const response = await fetch('/api/drafts', { headers: await authHeader(), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '초안을 불러오지 못했습니다.');
      setRemoteDrafts(result.drafts ?? []);
      setDraftsLoaded(true);
      setNotice(`${result.drafts?.length ?? 0}개 초안을 조회했습니다.`);
    } catch (error) { setNotice(`서버 연결 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`); }
    finally { setLoadingDrafts(false); }
  }

  async function saveDraft(duplicate = false) {
    if (loadingDrafts) return;
    setLoadingDrafts(true);
    try {
      const payload: CardDraft = { title: storyTitle.trim() || slides[0].title, category, brand, sourceUrls, slides, caption, hashtags: normalizeHashtags(hashtags) };
      const editing = Boolean(currentDraftId && !duplicate);
      const response = await fetch('/api/drafts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { ...await authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editing
          ? { id: currentDraftId, draft: payload }
          : { ...payload, trendId: duplicate ? null : sourceTrendId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '초안을 저장하지 못했습니다.');
      if (!editing) {
        setCurrentDraftId(result.id);
        setPublishStatus('review');
        if (duplicate) setSourceTrendId(null);
      }
      if (sourceTrendId && !duplicate && !editing) { setTrendsLoaded(false); await fetchTrends(); }
      await fetchDrafts();
      setNotice(editing
        ? (publishStatus === 'published'
          ? '기존 게시글의 변경사항을 저장했습니다. 인스타그램에 이미 올린 게시물은 자동 수정되지 않습니다.'
          : '기존 게시글에 변경사항을 저장했습니다.')
        : duplicate ? '기존 글을 보존하고 복제본을 새 게시글로 저장했습니다.' : '새 게시글을 저장했습니다.');
    } catch (error) { setNotice(`저장 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`); }
    finally { setLoadingDrafts(false); }
  }

  async function changePublishStatus(next: PublishStatus) {
    if (!currentDraftId) { setNotice('먼저 현재 원고를 저장한 뒤 게시 상태를 변경해주세요.'); return; }
    setPublishBusy(true);
    try {
      const response = await fetch('/api/drafts', { method: 'PATCH', headers: { ...await authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentDraftId, publishStatus: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '게시 상태 변경 실패');
      setPublishStatus(next); setDraftsLoaded(false);
      setNotice(next === 'published' ? '게시 완료로 기록했습니다. 인스타그램 실제 발행 여부는 직접 확인해주세요.' : `${publishLabels[next]} 상태로 저장했습니다.`);
    } catch (error) { setNotice(`게시 상태 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setPublishBusy(false); }
  }

  async function fetchTrends() {
    setLoadingTrends(true);
    try {
      const response = await fetch('/api/trends', { headers: await authHeader(), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '트렌드 목록 오류');
      setTrendRows(result.trends ?? []);
      setTrendsLoaded(true);
      setNotice(`${result.trends?.length ?? 0}개 트렌드 후보를 불러왔습니다.`);
    } catch (error) { setNotice(`트렌드 조회 실패: ${error instanceof Error ? error.message : '연결 오류'}`); }
    finally { setLoadingTrends(false); }
  }

  async function withTimeout<T>(task: Promise<T>, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([task, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 20000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }

  async function fontStyles() {
    const element = captureRefs.current[0];
    if (!element) throw new Error('카드 렌더링 요소를 찾지 못했습니다.');
    // Font fetching is expensive; collect the styles once per export, not once per card.
    return withTimeout(getFontEmbedCSS(element), '폰트 로딩 시간이 초과되었습니다. 다시 시도해주세요.');
  }

  async function renderSlide(i: number, fontEmbedCSS: string) {
    const element = captureRefs.current[i];
    if (!element) throw new Error('이미지 렌더링 요소를 찾을 수 없습니다.');
    const slide = slides[i];
    const image = element.querySelector<HTMLImageElement>('.card-media img');
    const needsImage = Boolean(slide.imagePath && slide.layout !== 'text');
    if (needsImage && !image) throw new Error(`${i + 1}번 카드의 이미지 요소가 없습니다.`);
    const originalSrc = image?.getAttribute('src') ?? '';
    try {
      if (needsImage && image) {
        // html-to-image may silently omit cross-origin signed images. Embed authenticated
        // image bytes into the capture element before cloning it to SVG/PNG.
        const response = await withTimeout(fetch(`/api/media?path=${encodeURIComponent(slide.imagePath!)}`, {
          headers: await authHeader(), cache: 'no-store',
        }), `${i + 1}번 카드 이미지 요청이 지연되고 있습니다.`);
        if (!response.ok) throw new Error(`${i + 1}번 카드 이미지를 불러오지 못했습니다. 다시 로그인 후 시도해주세요.`);
        const file = await response.blob();
        if (!file.type.startsWith('image/') || file.size === 0) throw new Error(`${i + 1}번 카드 이미지 파일이 비어 있습니다.`);
        const embedded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('이미지 변환 오류'));
          reader.onerror = () => reject(new Error('이미지 변환 오류'));
          reader.readAsDataURL(file);
        });
        image.src = embedded;
        await withTimeout(image.decode(), `${i + 1}번 카드 이미지 로딩 시간이 초과되었습니다.`);
        if (!image.naturalWidth || !image.naturalHeight) throw new Error(`${i + 1}번 카드 이미지가 손상되었습니다.`);
      }
      const blob = await withTimeout(
        toBlob(element, { pixelRatio: 1, width: 1080, height: 1350, fontEmbedCSS, cacheBust: true }),
        `${i + 1}번 카드의 렌더링 시간이 초과되었습니다.`,
      );
      if (!blob) throw new Error(`${i + 1}번 카드의 이미지 생성에 실패했습니다.`);
      // iOS Safari may omit an <img> inside html-to-image's SVG foreignObject
      // even when the image is fully loaded. Paint the original media directly
      // on the exported PNG with Canvas so the photo cannot silently disappear.
      if (needsImage && image && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        return await withTimeout(compositeSafariImage(blob, image, element, fontEmbedCSS), `${i + 1}번 카드 Safari 이미지 합성 시간이 초과되었습니다.`);
      }
      return blob;
    } finally {
      if (image && needsImage) image.src = originalSrc;
    }
  }

  async function compositeSafariImage(baseBlob: Blob, source: HTMLImageElement, captureRoot: HTMLElement, fontEmbedCSS: string): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Safari 이미지 합성 기능을 사용할 수 없습니다.');
    const baseUrl = URL.createObjectURL(baseBlob);
    try {
      const rendered = new Image();
      rendered.src = baseUrl;
      await rendered.decode();
      ctx.drawImage(rendered, 0, 0, 1080, 1350);
      const cardRect = captureRoot.querySelector('.news-card')?.getBoundingClientRect();
      const mediaRect = source.getBoundingClientRect();
      if (!cardRect || !mediaRect.width || !mediaRect.height) throw new Error('이미지 배치 영역을 찾지 못했습니다.');
      const x = mediaRect.left - cardRect.left;
      const y = mediaRect.top - cardRect.top;
      const width = mediaRect.width;
      const height = mediaRect.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
      const scale = getComputedStyle(source).objectFit === 'cover'
        ? Math.max(width / source.naturalWidth, height / source.naturalHeight)
        : Math.min(width / source.naturalWidth, height / source.naturalHeight);
      const drawW = source.naturalWidth * scale;
      const drawH = source.naturalHeight * scale;
      const backgroundCover = Boolean(source.closest('.cover-background'));
      ctx.globalAlpha = backgroundCover ? 0.85 : 1;
      ctx.drawImage(source, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
      ctx.restore();
      if (backgroundCover) {
        // Safari's manual photo composite must restore the gradient and labels above it.
        const shade = ctx.createLinearGradient(0, 0, 0, 1350);
        shade.addColorStop(0, '#0c1735a0');
        shade.addColorStop(0.28, '#0c173500');
        shade.addColorStop(0.58, '#0c173575');
        shade.addColorStop(1, '#0c1735ef');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, 1080, 1350);
        for (const selector of ['.card-top', '.card-content', '.card-bottom']) {
          const section = captureRoot.querySelector<HTMLElement>(selector);
          if (!section) continue;
          const rect = section.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const overlay = await toBlob(section, {
            pixelRatio: 1, width: Math.ceil(rect.width), height: Math.ceil(rect.height), fontEmbedCSS,
          });
          if (!overlay) throw new Error('Safari 표지 글자 합성에 실패했습니다.');
          const overlayUrl = URL.createObjectURL(overlay);
          try {
            const layer = new Image();
            layer.src = overlayUrl;
            await layer.decode();
            ctx.drawImage(layer, rect.left - cardRect.left, rect.top - cardRect.top, rect.width, rect.height);
          } finally { URL.revokeObjectURL(overlayUrl); }
        }
      }
      const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Safari 합성 PNG 생성에 실패했습니다.')), 'image/png'));
      return result;
    } finally { URL.revokeObjectURL(baseUrl); }
  }

  function download(dataUrl: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = dataUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }

  async function previewActualPng() {
    setRenderingPreview(true); setNotice('실제 저장 PNG 미리보기 생성 중...');
    const signature = shareSignature;
    try {
      const styles = await fontStyles();
      const blob = await renderSlide(selected, styles);
      const url = URL.createObjectURL(blob);
      setRenderedPreview({ signature, url, blob });
      setNotice('이 화면은 실제 PNG 저장 결과와 동일합니다. 수정하면 미리보기를 다시 생성해주세요.');
    } catch (error) { setNotice(`실제 PNG 미리보기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setRenderingPreview(false); }
  }

  async function downloadOne() {
    setBusy(true); setNotice('');
    setProgress('폰트 준비 중...');
    try {
      const cached = renderedPreview?.signature === shareSignature ? renderedPreview.blob : null;
      const styles = cached ? '' : await fontStyles();
      setProgress('PNG 생성 중...');
      const blob = cached ?? await renderSlide(selected, styles);
      const url = URL.createObjectURL(blob);
      download(url, fileName(selected));
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice('현재 카드 PNG가 다운로드되었습니다.');
    }
    catch (error) { setNotice(`다운로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setBusy(false); setProgress(''); }
  }

  async function downloadAll() {
    setBusy(true); setNotice('');
    try {
      setProgress('폰트 준비 중...');
      const styles = await fontStyles();
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        setProgress(`${i + 1} / ${slides.length}장 이미지 생성 중...`);
        const blob = await renderSlide(i, styles);
        zip.file(fileName(i), blob);
      }
      setProgress('ZIP 압축 중...');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      download(url, 'trend-studio-cards.zip');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(`카드 ${slides.length}장을 ZIP으로 다운로드했습니다.`);
    } catch (error) { setNotice(`이미지 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setBusy(false); setProgress(''); }
  }

  function sharePhotos(kind: ShareKind) {
    if (busy) return;
    if (!navigator.share || !navigator.canShare) {
      setNotice('이 브라우저에서는 사진 공유를 지원하지 않습니다. PNG 또는 ZIP 다운로드를 이용해주세요.');
      if (kind === 'one') void downloadOne(); else void downloadAll();
      return;
    }
    const ready = preparedShare?.kind === kind && preparedShare.signature === shareSignature;
    if (ready) {
      if (!navigator.canShare({ files: preparedShare.files })) {
        setNotice('이 브라우저에서 PNG 공유를 지원하지 않습니다. 다운로드 버튼을 이용해주세요.');
        return;
      }
      // Share must start directly in the tap handler to preserve browser user activation.
      void navigator.share({ files: preparedShare.files }).then(() => {
        setNotice('공유 화면에서 사진 저장을 선택해주세요.');
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNotice('공유 화면을 열지 못했습니다. PNG 다운로드를 이용해주세요.');
      });
      return;
    }
    void preparePhotos(kind, shareSignature);
  }

  async function preparePhotos(kind: ShareKind, signature: string) {
    setBusy(true); setProgress('사진 공유 준비 중...'); setNotice(''); setPreparedShare(null);
    try {
      const styles = await fontStyles();
      const indices = kind === 'one' ? [selected] : slides.map((_, i) => i);
      const files: File[] = [];
      for (const i of indices) {
        setProgress(`${i + 1}번 카드 PNG 생성 중...`);
        files.push(new File([await renderSlide(i, styles)], fileName(i), { type: 'image/png' }));
      }
      if (!navigator.canShare({ files })) throw new Error('이 브라우저에서 PNG 파일 공유를 지원하지 않습니다.');
      setPreparedShare({ kind, signature, files });
      setNotice(`${files.length}장 준비 완료! 같은 사진 공유 버튼을 한 번 더 누르면 앨범 저장 메뉴가 열립니다.`);
    } catch (error) { setNotice(`공유 준비 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setBusy(false); setProgress(''); }
  }

  const readyToShare = (kind: ShareKind) => preparedShare?.kind === kind && preparedShare.signature === shareSignature;

  async function copyContent() {
    const content = slides.map((slide, i) => `${i + 1}. ${slide.title}\n${slide.body}`).join('\n\n');
    try { await navigator.clipboard.writeText(content); setNotice('카드 원고를 복사했습니다.'); }
    catch { setNotice('복사할 수 없습니다. 브라우저 권한을 확인해주세요.'); }
  }
  async function copyCaption() {
    try { await navigator.clipboard.writeText([caption.trim(), normalizeHashtags(hashtags)].filter(Boolean).join('\n\n')); setNotice('인스타 게시글 내용을 복사했습니다.'); }
    catch { setNotice('복사할 수 없습니다. 브라우저 권한을 확인해주세요.'); }
  }

  const days = [...new Set(trendRows.map(item => koreanDate(item.created_at)))];
  const visibleTrends = dateFilter === 'all' ? trendRows : trendRows.filter(item => koreanDate(item.created_at) === dateFilter);

  return <main className="app-shell">
    <header className="header"><div className="logo"><div className="logo-icon"><Layers3 size={22} /></div><div><strong>trend<span>studio.</span></strong><small>CONTENT DESIGN WORKSPACE</small></div></div><div className="header-right"><span className="version">BETA / 0.1</span><span className="saved"><span /> Local preview</span><button className="page-refresh" type="button" title="페이지 전체 새로고침" aria-label="페이지 새로고침" onClick={() => window.location.reload()}><RefreshCw size={17}/><span>새로고침</span></button></div></header>
    <nav className="studio-tabs" aria-label="스튜디오 메뉴">
      <button className={view === 'trends' ? 'active' : ''} aria-current={view === 'trends' ? 'page' : undefined} onClick={() => setView('trends')}><TrendingUp size={18}/> 트렌드 탐색</button>
      <button className={view === 'drafts' ? 'active' : ''} aria-current={view === 'drafts' ? 'page' : undefined} onClick={() => setView('drafts')}><Newspaper size={18}/> 내 게시글</button>
      <button className={view === 'editor' ? 'active' : ''} aria-current={view === 'editor' ? 'page' : undefined} onClick={() => setView('editor')}><PencilLine size={18}/> 카드 편집기</button>
    </nav>
    {view === 'editor' && <section className="top-heading"><div><div className="eyebrow"><Sparkles size={14}/> YOUR CREATIVE WORKSPACE</div><h1>카드뉴스 스튜디오<span>.</span></h1><p>4~8장의 이미지와 텍스트를 편집하고 인스타 게시글까지 준비하세요.</p></div><div className="top-actions"><button className="primary-button share-button" onClick={() => sharePhotos('all')} disabled={busy}><Images size={17}/>{busy ? progress : readyToShare('all') ? `${slides.length}장 공유 메뉴 열기` : `${slides.length}장 사진 공유 준비`}</button><button className="primary-button top-download" onClick={downloadAll} disabled={busy}><ArrowDownToLine size={17}/>{slides.length}장 ZIP 다운로드</button></div></section>}
    <section className={`import-panel panel ${view !== 'editor' ? 'account-strip' : ''}`}>
      {view === 'editor' && <>
      <div className="import-panel-title"><div><span className="step-label">CONTENT PIPELINE</span><h2>ChatGPT 원고 가져오기</h2><p>예약 브리핑의 JSON을 붙여넣으면 1~10개 원고를 검증한 뒤 검토함에 한 번에 저장할 수 있어요.</p></div><button className="import-toggle" onClick={() => setShowImport(open => !open)}><FileJson size={16}/>{showImport ? '가져오기 닫기' : 'JSON 가져오기'}</button></div>
      {showImport && <div className="import-content"><div><label htmlFor="json-input">ChatGPT 원고 JSON (단일 원고 또는 {`{"drafts":[...]}`} 묶음)</label><textarea id="json-input" value={jsonText} onChange={event => setJsonText(event.target.value)} placeholder='{"drafts":[{"title":"뉴스 제목","category":"AI","slides":[...],"caption":"...","hashtags":"...","imagePlan":[...]}]}' rows={7}/><div className="import-buttons"><button onClick={importJson}>첫 번째 원고 편집</button><button onClick={() => void importAndSaveAll()} disabled={!signedInEmail || importBusy}>{importBusy ? '저장 중...' : '전체 원고 검토함에 저장'}</button><button onClick={exportJson}>현재 원고 내보내기</button></div><p className="import-tip">이미지 배치 계획과 캡션도 함께 보관됩니다. 실제 이미지 파일이 없는 카드는 검토함에서 별도로 표시돼요.</p></div></div>}
      </>}
      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-icon"><LockKeyhole size={18}/></span><div><strong>관리자 스튜디오</strong><small>{signedInEmail ? `로그인: ${signedInEmail}` : '로그인 후 카드뉴스를 저장하고 관리할 수 있습니다.'}</small></div>{signedInEmail && <button className="admin-logout" onClick={logoutAdmin}><LogOut size={14}/> 로그아웃</button>}</div>
        {authChecking ? <p className="admin-hint">로그인 상태 확인 중...</p> : !adminClient ? <p className="admin-hint">관리자 로그인을 사용하려면 Supabase 공개 연결 설정이 필요합니다.</p> : !signedInEmail ? (
          <form className="admin-login" onSubmit={loginAdmin}>
            <label>관리자 이메일<input type="email" autoComplete="username" required value={adminEmail} onChange={event => setAdminEmail(event.target.value)} placeholder="admin@example.com"/></label>
            <label>비밀번호<input type="password" autoComplete="current-password" required value={adminPassword} onChange={event => setAdminPassword(event.target.value)} placeholder="비밀번호 입력"/></label>
            <button className="admin-submit" type="submit" disabled={authBusy}>{authBusy ? '로그인 중...' : '관리자 로그인'}</button>
          </form>
        ) : view === 'editor' ? (
          <div className="admin-workspace">
            <button className="admin-password-toggle" onClick={() => setShowPasswordUpdate(value => !value)}>{showPasswordUpdate ? '비밀번호 설정 닫기' : '초대받았나요? 비밀번호 설정·변경'}</button>
            {showPasswordUpdate && <form className="admin-login admin-password-form" onSubmit={updateAdminPassword}><label>새 비밀번호 (12자 이상)<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={event => setNewPassword(event.target.value)}/></label><button className="admin-submit" type="submit" disabled={authBusy}>{authBusy ? '설정 중...' : '비밀번호 설정'}</button></form>}
            <label>게시글 제목<input maxLength={160} value={storyTitle} onChange={event => setStoryTitle(event.target.value)}/></label>
            <div className="admin-buttons"><button onClick={() => void saveDraft()} disabled={loadingDrafts}>{loadingDrafts ? '저장 중...' : currentDraftId ? '변경사항 저장' : `새 게시글 저장 (${slides.length}장)`}</button>{currentDraftId && <button onClick={() => void saveDraft(true)} disabled={loadingDrafts}>복제해서 저장</button>}<button onClick={() => setView('drafts')}>내 게시글 보기</button></div>
          </div>
        ) : null}
      </div>
    </section>
    {view === 'trends' && <section className="collection-page">
      <div className="collection-header"><div><span className="step-label">DAILY TREND RADAR</span><h1>오늘의 트렌드<span>.</span></h1><p>정보 가치 55% · 화제성 30% · 시각적 매력 15%를 기준으로 검토합니다.</p></div><button className="collection-refresh" disabled={loadingTrends || !signedInEmail} onClick={fetchTrends}><RefreshCw size={16}/>{loadingTrends ? '조회 중...' : '새로고침'}</button></div>
      {signedInEmail ? <><div className="collection-controls"><div><strong>{visibleTrends.length}개 트렌드</strong><small>출처와 선정 이유를 확인한 후 편집하세요.</small></div><label><CalendarDays size={16}/><select aria-label="수집 날짜" value={dateFilter} onChange={e => setDateFilter(e.target.value)}><option value="all">전체 날짜</option>{days.map(day => <option key={day} value={day}>{day}</option>)}</select></label></div>
        {trendsLoaded && visibleTrends.length === 0 && <div className="collection-empty">{dateFilter === 'all' ? '아직 저장된 트렌드가 없습니다.' : '선택한 날짜에 수집된 트렌드가 없습니다.'}</div>}
        <div className="trend-grid">{visibleTrends.map(trend => <article className="trend-item" key={trend.id}>
          <div className="trend-item-head"><span className="trend-category">{trend.category}</span><span>{koreanDate(trend.created_at)}</span></div>
          <div className="trend-status-line"><h3>{trend.title}</h3><span className={`production-status production-${trend.production_status || 'unmade'}`}>{({ unmade: '⚪ 미제작', in_progress: '🟡 제작 중', completed: '🟢 제작 완료', failed: '🔴 제작 실패' } as Record<string,string>)[trend.production_status || 'unmade']}</span></div><p>{trend.summary}</p>
          <div className="trend-metrics"><span>화제성 <strong>{trend.buzz_score}</strong></span><span>정보 가치 <strong>{trend.value_score}</strong></span></div>
          <div className="trend-why"><strong>왜 지금?</strong><p>{trend.why_now}</p></div>
          <div className="trend-sources">{trend.source_urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">출처 {i + 1} <ExternalLink size={12}/></a>)}</div>
          <button className="trend-apply" disabled={trend.production_status === 'in_progress'} onClick={() => { if (trend.production_status === 'completed' && trend.linked_draft_id) { setView('drafts'); if (!draftsLoaded) void fetchDrafts(); return; } try { applyDraft(parseCardDraft(trend.draft), trend.id); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { setNotice('후보 원고 형식이 올바르지 않습니다.'); } }}>{trend.production_status === 'completed' && trend.linked_draft_id ? '제작된 게시글 보기' : trend.production_status === 'in_progress' ? '제작 중' : '카드뉴스 제작하기'} <ArrowRight size={15}/></button>
        </article>)}</div>
      </> : <div className="collection-empty">관리자 로그인 후 수집된 트렌드를 확인할 수 있습니다.</div>}
    </section>}
    {view === 'drafts' && <section className="collection-page"><div className="collection-header"><div><span className="step-label">MY CONTENT LIBRARY</span><h1>내 게시글<span>.</span></h1><p>저장한 카드뉴스를 다시 불러와 수정하고 새 버전으로 저장하세요.</p></div><button className="collection-refresh" disabled={loadingDrafts || !signedInEmail} onClick={fetchDrafts}><RefreshCw size={16}/>{loadingDrafts ? '조회 중...' : '새로고침'}</button></div>
      {signedInEmail ? <><div className="collection-controls"><div><strong>검토할 게시글 {remoteDrafts.length}개</strong><small>최근 저장된 초안 30개 · 원고/이미지 상태를 확인하세요.</small></div><button className="collection-refresh" onClick={() => { setView('editor'); setShowImport(true); }}><FileJson size={15}/> ChatGPT 원고 가져오기</button></div><div className="trend-grid">{remoteDrafts.map(draft => { const pending = draft.slides.filter(s => s.imageMode && s.imageMode !== 'none' && !s.imagePath).length; return <article className="trend-item" key={draft.id}><div className="trend-item-head"><span className="trend-category">{draft.category}</span><span>{draft.slides.length} SLIDES</span></div><div className="trend-status-line"><h3>{draft.title}</h3><span className={`publish-status publish-${draft.publish_status ?? 'review'}`}>{publishLabels[draft.publish_status ?? 'review']}</span></div><div className="draft-readiness"><span className="readiness-ok">원고 {draft.slides.length}장</span><span className={draft.caption ? 'readiness-ok' : 'readiness-warn'}>캡션 {draft.caption ? '완료' : '미작성'}</span><span className={pending ? 'readiness-warn' : 'readiness-ok'}>{pending ? `이미지 ${pending}장 준비 필요` : '이미지 검토 가능'}</span></div><p>검토 후 수정하고 PNG와 게시글 내용을 저장하세요.</p><button className="trend-apply" onClick={() => { try { applyDraft({ ...parseCardDraft({ title: draft.title, category: draft.category, brand: draft.brand, sourceUrls: draft.source_urls, slides: draft.slides, caption: draft.caption, hashtags: draft.hashtags }), slides: draft.slides }, null, draft.id, draft.publish_status ?? 'review'); } catch { setNotice('서버 초안 형식이 올바르지 않습니다.'); } }}>{draft.publish_status === 'published' ? '게시글 다시 보기' : '인스타 게시 준비'} <ArrowRight size={15}/></button></article>; })}</div>{draftsLoaded && remoteDrafts.length === 0 && <div className="collection-empty">저장된 게시글이 없습니다. ChatGPT 원고를 가져와 검토함에 저장해보세요.</div>}</> : <div className="collection-empty">관리자 로그인 후 저장된 게시글을 확인할 수 있습니다.</div>}
    </section>}
    {view === 'editor' && <section className="workspace">
      <aside className="panel editor-panel"><div className="panel-heading"><span className="step-label">01 / CONTENT EDITOR</span><h2>콘텐츠 편집</h2><p>카드를 선택하고 내용을 수정해보세요.</p></div>
        <div className="field-row"><label>카테고리<input maxLength={25} value={category} onChange={e => setCategory(e.target.value)}/></label><label>브랜드명<input maxLength={24} value={brand} onChange={e => setBrand(e.target.value)}/></label></div>
        <div className="slide-section-title"><span>카드 구성</span><span>{slides.length} / 8 SLIDES</span></div><div className="slide-tabs">{slides.map((slide, i) => <button key={i} className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}><span>{String(i + 1).padStart(2, '0')}</span><small>{i === 0 ? '표지' : i === slides.length - 1 ? '마무리' : '본문'}</small></button>)}</div>
        <div className="slide-controls"><button disabled={slides.length >= 8} onClick={addSlide}><Plus size={15}/> 카드 추가</button><button disabled={slides.length <= 4} onClick={removeSlide}><Trash2 size={15}/> 현재 카드 삭제</button></div>
        <div className="edit-fields"><label>상단 라벨<input maxLength={35} value={slides[selected].kicker} onChange={e => updateSlide('kicker', e.target.value)}/></label><label>카드 제목<textarea rows={3} maxLength={110} value={slides[selected].title} onChange={e => updateSlide('title', e.target.value)}/><span className="character-count">{slides[selected].title.length} / 110</span></label><label>본문 내용<textarea rows={6} maxLength={350} value={slides[selected].body} onChange={e => updateSlide('body', e.target.value)}/><span className="character-count">{slides[selected].body.length} / 350</span></label></div>
        <div className="media-editor"><strong><ImagePlus size={16}/> 카드 이미지</strong>{slides[selected].imageMode && slides[selected].imageMode !== 'none' && <div className="image-brief"><strong>{slides[selected].imageMode === 'ai_concept' ? '🎨 AI 콘셉트 이미지 추천' : '📷 실제 이미지 추천 · 권리 확인 필요'}</strong>{slides[selected].imagePrompt && <p>제작 제안: {slides[selected].imagePrompt}</p>}{slides[selected].imageNote && <p>검토 사항: {slides[selected].imageNote}</p>}{slides[selected].imageSourceUrl && <a href={slides[selected].imageSourceUrl} rel="noopener noreferrer" target="_blank">참고 이미지 출처 열기 <ExternalLink size={12}/></a>}{!slides[selected].imagePath && <span className="image-pending">이미지 파일 준비 전 · 실제 파일을 확인하고 업로드하세요.</span>}</div>}<p>직접 촬영했거나 사용 권한이 있는 이미지를 업로드하세요. PNG·JPG·WebP, 최대 8MB.</p><label className="upload-trigger">{uploadBusy ? '업로드 중...' : '이미지 선택 / 업로드'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!signedInEmail || uploadBusy} onChange={event => { void uploadImage(event.target.files?.[0]); event.target.value = ''; }}/></label><label>사진 맞춤<select value={slides[selected].layout === 'background' ? 'cover' : (slides[selected].imageFit ?? 'contain')} disabled={slides[selected].layout === 'background'} onChange={event => updateSlide('imageFit', event.target.value)}><option value="contain">전체 보기 (잘리지 않음)</option><option value="cover">영역 채우기 (일부 잘릴 수 있음)</option></select>{slides[selected].layout === 'background' && <small>전체 배경형은 이미지가 카드 전체를 채우도록 자동 설정됩니다.</small>}</label><label>이미지와 글 배치<select value={slides[selected].layout ?? 'text'} onChange={event => updateSlide('layout', event.target.value)}><option value="text">텍스트 중심</option><option value="background" disabled={selected !== 0 || !slides[selected].imageUrl}>전체 배경형 (첫 장 · 하단 제목)</option><option value="image" disabled={!slides[selected].imageUrl}>이미지 강조형 (상단 이미지)</option><option value="split" disabled={!slides[selected].imageUrl}>균형형 (이미지 + 텍스트)</option></select></label>{slides[selected].imagePath && <button className="remove-image" onClick={() => setSlides(current => current.map((slide, i) => i === selected ? { ...slide, imagePath: undefined, imageUrl: undefined, layout: 'text' } : slide))}>이 카드에서 이미지 제거</button>}</div>
        <div className="editor-actions"><button onClick={() => { setSlides(initialSlides); setCategory('TECH / AI'); setBrand('TREND BRIEF'); setSelected(0); setNotice('샘플 콘텐츠로 복원했습니다.'); }}><RotateCcw size={15}/> 초기화</button><button onClick={copyContent}><Copy size={15}/> 원고 복사</button></div>
        <div className="instagram-publish-panel"><div className="instagram-publish-head"><div><strong>인스타 게시 준비</strong><p>개인 계정은 최종 업로드를 직접 완료해야 합니다. 먼저 현재 원고를 저장하세요.</p></div><span className={`publish-status publish-${publishStatus}`}>{publishLabels[publishStatus]}</span></div><div className="instagram-publish-actions"><button onClick={copyCaption}><Copy size={15}/> ① 캡션·해시태그 복사</button><button disabled={busy} onClick={() => sharePhotos('all')}><Share2 size={15}/> ② {readyToShare('all') ? '사진 공유 메뉴 열기' : `${slides.length}장 사진 공유 준비`}</button><button disabled={busy} onClick={downloadAll}><ArrowDownToLine size={15}/> 공유가 안 되면 ZIP 저장</button></div><p className="instagram-publish-help">휴대폰 공유 메뉴가 여러 장 선택을 지원하지 않을 수도 있어요. 그때는 ZIP을 내려받아 사진으로 저장한 뒤 Instagram 앱에서 순서대로 선택하세요. 캡션은 붙여넣으면 됩니다.</p><div className="instagram-publish-status"><button disabled={!currentDraftId || publishBusy} onClick={() => void changePublishStatus('ready')}>게시 준비 완료</button><button disabled={!currentDraftId || publishBusy || publishStatus !== 'ready'} onClick={() => void changePublishStatus('published')}>인스타에 게시했어요</button><button disabled={!currentDraftId || publishBusy} onClick={() => void changePublishStatus('held')}>보류</button></div>{!currentDraftId && <small>게시 상태 저장은 ‘새 게시글 저장’ 후 사용할 수 있습니다.</small>}{publishStatus === 'published' && <small>실제 인스타그램 게시 여부는 자동 검증되지 않습니다.</small>}</div><div className="caption-editor"><h3>인스타 게시글</h3><p>카드뉴스와 함께 올릴 캡션 및 해시태그를 수정하고 복사하세요.</p><label>게시글 내용<textarea rows={8} maxLength={2200} placeholder="ChatGPT가 작성한 인스타 캡션을 입력하세요." value={caption} onChange={event => setCaption(event.target.value)}/></label><label>해시태그 (최대 5개)<textarea rows={3} maxLength={500} placeholder="#오늘의트렌드 #트렌드" value={hashtags} onChange={event => setHashtags(event.target.value)}/><small>게시글 저장·복사 시 중복을 제외하고 최대 5개만 사용합니다.</small></label><button onClick={copyCaption}><Copy size={15}/> 인스타 게시글 복사</button></div>
      </aside>
      <section className="panel preview-panel"><div className="panel-heading preview-title"><div><span className="step-label">02 / LIVE PREVIEW</span><h2>실시간 미리보기</h2><p>1080 × 1350px · Instagram 4:5</p></div><span className="preview-live"><span/> LIVE</span></div><div className="preview-stage"><div className="preview-card-wrap">{renderedPreview?.signature === shareSignature ? <img className="actual-png-preview" src={renderedPreview.url} alt="실제 저장되는 1080 x 1350 PNG 미리보기" /> : <Card slide={slides[selected]} index={selected} total={slides.length} theme={theme} category={category} brand={brand}/>}</div></div><div className="preview-mode-note">{renderedPreview?.signature === shareSignature ? '✅ 실제 저장 PNG · 1080 × 1350px · 화면에 맞게 축소 표시' : '편집용 CSS 미리보기 · 실제 저장 결과를 확인하려면 아래 버튼을 눌러주세요.'}</div><button className="actual-preview-button" disabled={busy || renderingPreview} onClick={() => void previewActualPng()}>{renderingPreview ? '실제 PNG 생성 중...' : '실제 PNG 미리보기 생성'}</button><div className="preview-navigation"><button aria-label="이전 카드" onClick={() => setSelected(i => Math.max(0, i - 1))} disabled={selected === 0}><ArrowLeft size={17}/></button><div className="navigation-dots">{slides.map((_, i) => <button key={i} aria-label={`${i + 1}번 카드`} className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}/>)}</div><button aria-label="다음 카드" onClick={() => setSelected(i => Math.min(slides.length - 1, i + 1))} disabled={selected === slides.length - 1}><ArrowRight size={17}/></button></div><div className="preview-export-actions"><button className="secondary-download" disabled={busy} onClick={() => sharePhotos('one')}><Share2 size={16}/>{readyToShare('one') ? '현재 카드 공유 메뉴 열기' : '현재 카드 사진 공유 준비'}</button><button className="secondary-download" disabled={busy} onClick={downloadOne}><ArrowDownToLine size={16}/> 현재 카드 PNG 다운로드</button></div></section>
      <aside className="panel style-panel"><div className="panel-heading"><span className="step-label">03 / DESIGN SYSTEM</span><h2>디자인 스타일</h2><p>콘텐츠에 맞는 무드를 선택하세요.</p></div><div className="themes">{themes.map(item => <button key={item.id} className={`theme-option ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme(item.id)}><span className="theme-swatches">{item.colors.map(color => <span key={color} style={{ background: color }}/>)}</span><span className="theme-info"><strong>{item.name}</strong><small>{item.description}</small></span>{theme === item.id ? <span className="selected-check"><Check size={14}/></span> : <ChevronDown className="choose-arrow" size={15}/>}</button>)}</div><div className="info-card"><Sparkles size={18}/><strong>DESIGN TIP</strong><p>표지는 큰 제목 중심으로, 나머지 카드는 이미지와 한 가지 핵심 정보만 담아보세요.</p></div><div className="export-summary"><span>EXPORT SETTINGS</span><div><span>Format</span><strong>PNG</strong></div><div><span>Resolution</span><strong>1080 × 1350</strong></div><div><span>Cards</span><strong>{slides.length} slides</strong></div><div><span>Bundle</span><strong>ZIP archive</strong></div></div></aside>
    </section>}<footer className="footer"><span>© 2026 Trend Studio. Built for stories worth sharing.</span><span>뉴스의 사실 관계와 저작권은 게시 전 확인해주세요.</span></footer>{notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
    <div className="capture-container" aria-hidden="true">{slides.map((slide, i) => <div className="capture-item" key={i} ref={el => { captureRefs.current[i] = el; }}><Card slide={slide} index={i} total={slides.length} theme={theme} category={category} brand={brand} capture/></div>)}</div>
  </main>;
}
