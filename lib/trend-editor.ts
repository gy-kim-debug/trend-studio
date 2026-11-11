import { CardDraft, parseCardDraft } from '@/lib/content';

export type TrendCandidate = {
  title: string;
  category: string;
  summary: string;
  whyNow: string;
  buzzScore: number;
  valueScore: number;
  sourceUrls: string[];
  draft: CardDraft;
};

export function parseTrendCandidates(input: unknown, citedUrls: Set<string>): TrendCandidate[] {
  if (!input || typeof input !== 'object' || !('trends' in input) || !Array.isArray(input.trends)) throw new Error('트렌드 응답 형식 오류');
  if (input.trends.length < 1 || input.trends.length > 3) throw new Error('트렌드는 1~3개여야 합니다.');
  const seen = new Set<string>();
  return input.trends.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('트렌드 데이터 오류');
    const item = raw as Record<string, unknown>;
    const title = String(item.title ?? '').trim();
    const category = String(item.category ?? '').trim();
    const summary = String(item.summary ?? '').trim();
    const whyNow = String(item.whyNow ?? '').trim();
    const buzzScore = Number(item.buzzScore); const valueScore = Number(item.valueScore);
    if (!title || title.length > 150 || seen.has(title.toLowerCase()) || !category || category.length > 25 || !summary || summary.length > 600 || !whyNow || whyNow.length > 500) throw new Error('트렌드 제목/설명 검증 실패');
    if (![buzzScore, valueScore].every(n => Number.isInteger(n) && n >= 0 && n <= 100)) throw new Error('트렌드 점수 검증 실패');
    if (!Array.isArray(item.sourceUrls)) throw new Error('출처 검증 실패');
    const sourceUrls = Array.from(new Set(item.sourceUrls.filter((url): url is string => typeof url === 'string' && citedUrls.has(url)))).slice(0, 10);
    if (sourceUrls.length === 0) throw new Error('웹 검색으로 확인된 출처가 없는 트렌드가 포함되어 있습니다.');
    seen.add(title.toLowerCase());
    const draft = parseCardDraft({ ...item.draft as Record<string, unknown>, title, category, sourceUrls, brand: 'TREND BRIEF' });
    return { title, category, summary, whyNow, buzzScore, valueScore, sourceUrls, draft };
  });
}

export function editorPrompt(today: string, recentTitles: string[]): string {
  return `당신은 한국어 인스타그램 트렌드 카드뉴스 편집장입니다. 오늘 기준일은 ${today} (한국시간)입니다. 반드시 웹 검색으로 최근 48시간의 정보를 확인하세요. 평범한 사건 속보보다 사람들의 대화·소비·취향을 바꾸는 최신 트렌드에 집중하세요.
우선순위: AI·테크, 인터넷·SNS 문화, 라이프스타일, 브랜드·제품, 엔터테인먼트, 한국 이용자에게 의미 있는 글로벌 트렌드. 국내 관심사 2건과 해외발 관심사 1건을 균형 있게 고려하세요. 이미 다룬 주제는 제외: ${JSON.stringify(recentTitles)}.
화제성 50%, 실용/지식 가치 50%로 0~100점씩 평가합니다. 자극적 소문, 단순 광고, 미확인 숫자, 확인되지 않은 SNS 바이럴, 근거 없는 전망은 배제합니다. 선정한 각 항목은 서로 다른 신뢰 가능한 출처를 가능한 한 2개 이상 확인합니다.
단 3개 이하의 독립된 트렌드를 선정하세요. 사실과 해석을 구분하고 과장은 피하세요. 결과에는 검색 결과에서 실제로 확인한 https 원문 링크만 sourceUrls에 넣고, 링크는 응답의 인용 출처에도 표시하세요. 카드 내용은 원문을 베끼지 말고 직접 쓴 한국어로, 5장 순서(후킹/사실/배경/영향/한줄 정리)로 구성하세요. 카드 각 장의 kicker 35자 이하, title 110자 이하, body 350자 이하, 전체 제목 150자 이하입니다.
JSON 객체만 출력하세요. 형식: {"trends":[{"title":"...","category":"LIFESTYLE","summary":"검증된 핵심 사실","whyNow":"지금 주목할 이유","buzzScore":85,"valueScore":80,"sourceUrls":["https://..."],"draft":{"slides":[{"kicker":"HOOK","title":"...","body":"..."},{"kicker":"FACT","title":"...","body":"..."},{"kicker":"CONTEXT","title":"...","body":"..."},{"kicker":"IMPACT","title":"...","body":"..."},{"kicker":"TAKEAWAY","title":"...","body":"..."}]}}]}`;
}
