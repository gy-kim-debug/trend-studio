'use client';

import { useRef, useState } from 'react';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, FileJson, Layers3, RotateCcw, Sparkles } from 'lucide-react';
import { CardDraft, parseCardDraft, Slide } from '@/lib/content';

type Theme = 'midnight' | 'paper' | 'citrus';

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

function Card({ slide, index, theme, category, brand, capture = false }: { slide: Slide; index: number; theme: Theme; category: string; brand: string; capture?: boolean }) {
  return (
    <article className={`news-card theme-${theme}`} data-capture={capture ? 'true' : undefined}>
      <div className="card-shape shape-one" /><div className="card-shape shape-two" />
      <div className="card-top"><span className="card-tag">{category || 'TREND'}</span><span className="card-number">{String(index + 1).padStart(2, '0')} / 05</span></div>
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
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState<Theme>('midnight');
  const [category, setCategory] = useState('TECH / AI');
  const [brand, setBrand] = useState('TREND BRIEF');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [remoteDrafts, setRemoteDrafts] = useState<{ id: string; title: string; category: string; brand: string; source_urls: string[]; slides: Slide[] }[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [storyTitle, setStoryTitle] = useState('AI가 보안 코드의 안전성을 증명했다고?');
  const captureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const updateSlide = (key: keyof Slide, value: string) => setSlides(current => current.map((slide, i) => i === selected ? { ...slide, [key]: value } : slide));
  const fileName = (i: number) => `trend-studio-${String(i + 1).padStart(2, '0')}.png`;

  function applyDraft(draft: CardDraft) {
    setSlides(draft.slides); setCategory(draft.category); setBrand(draft.brand);
    setSourceUrls(draft.sourceUrls); setStoryTitle(draft.title); setSelected(0);
    setNotice('콘텐츠를 불러왔습니다. 게시 전 사실 관계를 검토해주세요.');
  }

  function importJson() {
    try { applyDraft(parseCardDraft(JSON.parse(jsonText))); setShowImport(false); }
    catch (error) { setNotice(`가져오기 실패: ${error instanceof Error ? error.message : '잘못된 JSON'}`); }
  }

  function exportJson() {
    const data: CardDraft = { title: storyTitle, category, brand, sourceUrls, slides };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    download(url, 'trend-studio-draft.json');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function fetchDrafts() {
    if (!apiToken.trim()) { setNotice('서버 연결 토큰을 입력해주세요.'); return; }
    setLoadingDrafts(true);
    try {
      const response = await fetch('/api/drafts', { headers: { Authorization: `Bearer ${apiToken}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '초안을 불러오지 못했습니다.');
      setRemoteDrafts(result.drafts ?? []);
      setNotice(`${result.drafts?.length ?? 0}개 초안을 조회했습니다.`);
    } catch (error) { setNotice(`서버 연결 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`); }
    finally { setLoadingDrafts(false); }
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
    const blob = await withTimeout(
      toBlob(element, { pixelRatio: 1, width: 1080, height: 1350, fontEmbedCSS }),
      `${i + 1}번 카드의 렌더링 시간이 초과되었습니다.`,
    );
    if (!blob) throw new Error(`${i + 1}번 카드의 이미지 생성에 실패했습니다.`);
    return blob;
  }

  function download(dataUrl: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = dataUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }

  async function downloadOne() {
    setBusy(true); setNotice('');
    setProgress('폰트 준비 중...');
    try {
      const styles = await fontStyles();
      setProgress('PNG 생성 중...');
      const blob = await renderSlide(selected, styles);
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
      setNotice('카드 5장을 ZIP으로 다운로드했습니다.');
    } catch (error) { setNotice(`이미지 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`); }
    finally { setBusy(false); setProgress(''); }
  }

  async function copyContent() {
    const content = slides.map((slide, i) => `${i + 1}. ${slide.title}\n${slide.body}`).join('\n\n');
    try { await navigator.clipboard.writeText(content); setNotice('카드 원고를 복사했습니다.'); }
    catch { setNotice('복사할 수 없습니다. 브라우저 권한을 확인해주세요.'); }
  }

  return <main className="app-shell">
    <header className="header"><div className="logo"><div className="logo-icon"><Layers3 size={22} /></div><div><strong>trend<span>studio.</span></strong><small>CONTENT DESIGN WORKSPACE</small></div></div><div className="header-right"><span className="version">BETA / 0.1</span><span className="saved"><span /> Local preview</span></div></header>
    <section className="top-heading"><div><div className="eyebrow"><Sparkles size={14}/> YOUR CREATIVE WORKSPACE</div><h1>카드뉴스 스튜디오<span>.</span></h1><p>하나의 스토리를 다섯 장의 콘텐츠로. 원고를 다듬고, 스타일을 고르고, 바로 내보내세요.</p></div><button className="primary-button top-download" onClick={downloadAll} disabled={busy}><ArrowDownToLine size={17}/>{busy ? progress : '5장 전체 다운로드'}</button></section>
    <section className="import-panel panel">
      <div className="import-panel-title"><div><span className="step-label">CONTENT PIPELINE</span><h2>ChatGPT 원고 가져오기</h2><p>JSON 붙여넣기로 바로 제작하거나, 서버에 등록된 초안을 선택하세요.</p></div><button className="import-toggle" onClick={() => setShowImport(open => !open)}><FileJson size={16}/>{showImport ? '가져오기 닫기' : 'JSON 가져오기'}</button></div>
      {showImport && <div className="import-content"><div><label htmlFor="json-input">ChatGPT 원고 JSON</label><textarea id="json-input" value={jsonText} onChange={event => setJsonText(event.target.value)} placeholder='{"title":"뉴스 제목","category":"TECH / AI","slides":[...]}' rows={7}/><div className="import-buttons"><button onClick={importJson}>5장 카드에 적용</button><button onClick={exportJson}>현재 원고 JSON 내보내기</button></div></div><div><label htmlFor="api-token">서버 연결 토큰 (세션 동안만 유지)</label><input id="api-token" type="password" autoComplete="off" value={apiToken} onChange={event => setApiToken(event.target.value)} placeholder="TREND_STUDIO_API_TOKEN"/><button className="load-drafts" onClick={fetchDrafts} disabled={loadingDrafts}>{loadingDrafts ? '조회 중...' : '서버에 저장된 초안 조회'}</button><div className="draft-list">{remoteDrafts.map(draft => <button key={draft.id} onClick={() => { try { applyDraft(parseCardDraft({ title: draft.title, category: draft.category, brand: draft.brand, sourceUrls: draft.source_urls, slides: draft.slides })); setShowImport(false); } catch { setNotice('서버 초안 형식이 올바르지 않습니다.'); } }}>{draft.title}<small>{draft.category}</small></button>)}</div></div></div>}
    </section>
    <section className="workspace">
      <aside className="panel editor-panel"><div className="panel-heading"><span className="step-label">01 / CONTENT EDITOR</span><h2>콘텐츠 편집</h2><p>카드를 선택하고 내용을 수정해보세요.</p></div>
        <div className="field-row"><label>카테고리<input maxLength={25} value={category} onChange={e => setCategory(e.target.value)}/></label><label>브랜드명<input maxLength={24} value={brand} onChange={e => setBrand(e.target.value)}/></label></div>
        <div className="slide-section-title"><span>카드 구성</span><span>5 SLIDES</span></div><div className="slide-tabs">{slides.map((slide, i) => <button key={i} className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}><span>{String(i + 1).padStart(2, '0')}</span><small>{['표지', '핵심 사실', '배경 설명', '영향', '마무리'][i]}</small></button>)}</div>
        <div className="edit-fields"><label>상단 라벨<input maxLength={35} value={slides[selected].kicker} onChange={e => updateSlide('kicker', e.target.value)}/></label><label>카드 제목<textarea rows={3} maxLength={110} value={slides[selected].title} onChange={e => updateSlide('title', e.target.value)}/><span className="character-count">{slides[selected].title.length} / 110</span></label><label>본문 내용<textarea rows={6} maxLength={350} value={slides[selected].body} onChange={e => updateSlide('body', e.target.value)}/><span className="character-count">{slides[selected].body.length} / 350</span></label></div>
        <div className="editor-actions"><button onClick={() => { setSlides(initialSlides); setCategory('TECH / AI'); setBrand('TREND BRIEF'); setSelected(0); setNotice('샘플 콘텐츠로 복원했습니다.'); }}><RotateCcw size={15}/> 초기화</button><button onClick={copyContent}><Copy size={15}/> 원고 복사</button></div>
      </aside>
      <section className="panel preview-panel"><div className="panel-heading preview-title"><div><span className="step-label">02 / LIVE PREVIEW</span><h2>실시간 미리보기</h2><p>1080 × 1350px · Instagram 4:5</p></div><span className="preview-live"><span/> LIVE</span></div><div className="preview-stage"><div className="preview-card-wrap"><Card slide={slides[selected]} index={selected} theme={theme} category={category} brand={brand}/></div></div><div className="preview-navigation"><button aria-label="이전 카드" onClick={() => setSelected(i => Math.max(0, i - 1))} disabled={selected === 0}><ArrowLeft size={17}/></button><div className="navigation-dots">{slides.map((_, i) => <button key={i} aria-label={`${i + 1}번 카드`} className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}/>)}</div><button aria-label="다음 카드" onClick={() => setSelected(i => Math.min(4, i + 1))} disabled={selected === 4}><ArrowRight size={17}/></button></div><button className="secondary-download" disabled={busy} onClick={downloadOne}><ArrowDownToLine size={16}/> 현재 카드 PNG 다운로드</button></section>
      <aside className="panel style-panel"><div className="panel-heading"><span className="step-label">03 / DESIGN SYSTEM</span><h2>디자인 스타일</h2><p>콘텐츠에 맞는 무드를 선택하세요.</p></div><div className="themes">{themes.map(item => <button key={item.id} className={`theme-option ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme(item.id)}><span className="theme-swatches">{item.colors.map(color => <span key={color} style={{ background: color }}/>)}</span><span className="theme-info"><strong>{item.name}</strong><small>{item.description}</small></span>{theme === item.id ? <span className="selected-check"><Check size={14}/></span> : <ChevronDown className="choose-arrow" size={15}/>}</button>)}</div><div className="info-card"><Sparkles size={18}/><strong>DESIGN TIP</strong><p>긴 문장은 두세 문장으로 나눠보세요. 카드 한 장에 메시지 하나만 담으면 더 잘 읽힙니다.</p></div><div className="export-summary"><span>EXPORT SETTINGS</span><div><span>Format</span><strong>PNG</strong></div><div><span>Resolution</span><strong>1080 × 1350</strong></div><div><span>Cards</span><strong>5 slides</strong></div><div><span>Bundle</span><strong>ZIP archive</strong></div></div></aside>
    </section><footer className="footer"><span>© 2026 Trend Studio. Built for stories worth sharing.</span><span>뉴스의 사실 관계와 저작권은 게시 전 확인해주세요.</span></footer>{notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
    <div className="capture-container" aria-hidden="true">{slides.map((slide, i) => <div className="capture-item" key={i} ref={el => { captureRefs.current[i] = el; }}><Card slide={slide} index={i} theme={theme} category={category} brand={brand} capture/></div>)}</div>
  </main>;
}
