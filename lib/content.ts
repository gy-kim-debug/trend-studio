export type Slide = { kicker: string; title: string; body: string };
export type CardDraft = {
  title: string;
  category: string;
  brand: string;
  sourceUrls: string[];
  slides: Slide[];
};

export function parseCardDraft(input: unknown): CardDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON 객체가 필요합니다.');
  const data = input as Record<string, unknown>;
  if (!Array.isArray(data.slides) || data.slides.length !== 5) throw new Error('slides 배열에는 카드 5장이 정확히 필요합니다.');
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
  };
}
