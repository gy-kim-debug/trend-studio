export type Slide = {
  kicker: string; title: string; body: string;
  imagePath?: string; imageUrl?: string; layout?: 'text' | 'image' | 'split' | 'background' | 'frame' | 'grid' | 'product' | 'data' | 'meme'; imageFit?: 'contain' | 'cover';
  imageMode?: 'none' | 'official_image' | 'ai_concept';
  imagePrompt?: string; imageSourceUrl?: string; imageNote?: string;
};
export type CardDraft = {
  title: string;
  category: string;
  brand: string;
  sourceUrls: string[];
  slides: Slide[];
  caption?: string;
  hashtags?: string;
};

/** Keep at most five distinct hashtags in their original order. */
export function normalizeHashtags(value: string): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const match of value.matchAll(/#[^\s#,，]+/gu)) {
    const tag = match[0].replace(/[.,!?;:]+$/u, '');
    if (!tag || seen.has(tag.toLocaleLowerCase())) continue;
    seen.add(tag.toLocaleLowerCase());
    tags.push(tag);
    if (tags.length === 5) break;
  }
  return tags.join(' ');
}

export function parseCardDraft(input: unknown): CardDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON 객체가 필요합니다.');
  const data = input as Record<string, unknown>;
  if (!Array.isArray(data.slides) || data.slides.length < 4 || data.slides.length > 8) throw new Error('slides 배열에는 카드가 4~8장 필요합니다.');
  const text = (value: unknown, label: string, max: number) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}은 비어 있지 않은 문자열이어야 합니다.`);
    if (value.length > max) throw new Error(`${label}은 ${max}자 이하여야 합니다.`);
    return value.trim();
  };
  const slides = data.slides.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${i + 1}번 카드 형식이 올바르지 않습니다.`);
    const slide = raw as Record<string, unknown>;
    return {
      kicker: text(slide.kicker, `${i + 1}번 상단 라벨`, 35),
      title: text(slide.title, `${i + 1}번 제목`, 110),
      body: text(slide.body, `${i + 1}번 본문`, 350),
      ...(typeof slide.imagePath === 'string' && /^cards\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(slide.imagePath) ? { imagePath: slide.imagePath } : {}),
      layout: (typeof slide.layout === 'string' && ['text','image','split','background','frame','grid','product','data','meme'].includes(slide.layout) ? slide.layout : 'text') as Slide['layout'],
      imageFit: (slide.imageFit === 'cover' ? 'cover' : 'contain') as Slide['imageFit'],
      imageMode: (slide.imageMode === 'official_image' || slide.imageMode === 'ai_concept' ? slide.imageMode : 'none') as Slide['imageMode'],
      imagePrompt: typeof slide.imagePrompt === 'string' ? slide.imagePrompt.slice(0, 1200) : '',
      imageSourceUrl: typeof slide.imageSourceUrl === 'string' && /^https:\/\//.test(slide.imageSourceUrl) ? slide.imageSourceUrl.slice(0, 2048) : '',
      imageNote: typeof slide.imageNote === 'string' ? slide.imageNote.slice(0, 500) : '',
    };
  });
  const urls = data.sourceUrls === undefined ? [] : data.sourceUrls;
  if (!Array.isArray(urls) || urls.length > 10 || !urls.every(url => typeof url === 'string' && /^https:\/\//.test(url) && url.length <= 2048)) {
    throw new Error('sourceUrls에는 https URL을 최대 10개까지 입력할 수 있습니다.');
  }
  return {
    title: text(data.title, '콘텐츠 제목', 150),
    category: text(data.category, '카테고리', 25),
    brand: typeof data.brand === 'string' && data.brand.trim() ? text(data.brand, '브랜드명', 24) : 'TREND BRIEF',
    sourceUrls: urls,
    slides,
    caption: typeof data.caption === 'string' ? data.caption.slice(0, 2200) : '',
    hashtags: typeof data.hashtags === 'string' ? normalizeHashtags(data.hashtags.slice(0, 500)) : '',
  };
}

/** Accept a single draft, a drafts array, or the scheduled ChatGPT imagePlan bundle. */
export function parseImportBundle(input: unknown): CardDraft[] {
  const root = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
  const raw = Array.isArray(input) ? input : root?.drafts ?? root?.candidates ?? (root?.draft ? [root.draft] : [input]);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) throw new Error('가져올 원고는 한 번에 1~10개여야 합니다.');
  return raw.map((item, draftIndex) => {
    const wrapper = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
    const rawDraft = wrapper.draft && typeof wrapper.draft === 'object' ? wrapper.draft : item;
    const data = rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft) ? rawDraft as Record<string, unknown> : {};
    const plan = Array.isArray(wrapper.imagePlan) ? wrapper.imagePlan : Array.isArray(data.imagePlan) ? data.imagePlan : [];
    const slides = Array.isArray(data.slides) ? data.slides.map((rawSlide, i) => {
      const s = rawSlide && typeof rawSlide === 'object' && !Array.isArray(rawSlide) ? rawSlide as Record<string, unknown> : {};
      const suggestion = plan.find((entry: unknown) => {
        const p = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return p.slide === i + 1 || p.slideIndex === i || p.index === i + 1;
      }) as Record<string, unknown> | undefined;
      return { ...s, ...(suggestion ? {
        imageMode: suggestion.imageMode ?? s.imageMode,
        imagePrompt: suggestion.prompt ?? suggestion.imagePrompt ?? s.imagePrompt,
        imageSourceUrl: suggestion.sourceUrl ?? s.imageSourceUrl,
        imageNote: suggestion.note ?? suggestion.rightsNote ?? s.imageNote,
        layout: suggestion.layout ?? s.layout,
      } : {}) };
    }) : data.slides;
    try { return parseCardDraft({ ...data, slides }); }
    catch (error) { throw new Error(`${draftIndex + 1}번 원고: ${error instanceof Error ? error.message : '형식 오류'}`); }
  });
}
