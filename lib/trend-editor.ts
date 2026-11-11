import { CardDraft, parseCardDraft } from '@/lib/content';

export type TrendCandidate = {
  title: string; category: string; summary: string; whyNow: string;
  buzzScore: number; valueScore: number; sourceUrls: string[]; draft: CardDraft;
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
  return `당신은 한국어 인스타그램 트렌드 카드뉴스 편집장입니다. 오늘 기준일은 ${today} 한국시간입니다. 반드시 웹 검색으로 최근 48시간 자료를 확인하세요. 평범한 속보보다 한국인의 대화·소비·취향을 바꿀 최신 트렌드에 집중하세요. 이미 다룬 주제는 제외: ${JSON.stringify(recentTitles)}.
AI·테크, SNS 문화, 캐릭터, 라이프스타일, 브랜드·제품, 엔터테인먼트를 고르게 검토하세요. 평가 기준은 정보 가치 55%, 화제성 30%, 시각적 전달력 15%. 확인되지 않은 사실과 수치, 단순 광고, 루머는 제외하세요.
서로 다른 트렌드 정확히 3개(믿을 만한 주제가 부족하면 1~2개)를 선정하세요. 각 주제별로 검증된 출처만 sourceUrls로 제시하고 반드시 웹 인용에 실린 https 원문 URL을 쓰세요. 날짜·사실·추론을 구분하세요.
각 주제의 draft는 정확히 5장의 카드뉴스, Instagram caption, 중복 없는 해시태그 3~5개를 반드시 포함해야 합니다. 5개 초과 금지. kicker 35자 이내, title 110자 이내, body 350자 이내. 첫 카드 후킹, 나머지 사실/배경/영향/결론.
중요: 이것은 실제 이미지 자동 제작을 위한 데이터입니다. 단순히 이미지를 추천하지 말고 각 슬라이드에 imageMode, imagePrompt, imageSourceUrl, imageNote, layout을 직접 적으세요.
- 진짜 제품·행사·인물·캐릭터의 모습을 설명하려면 imageMode='official_image'. imagePrompt에는 Wikimedia Commons에서 실물 사진을 검색할 때 쓰는 명확한 영어 검색어(주제 고유명사 우선)를 넣고, imageSourceUrl에는 해당 실물 정보의 공식 발표/제품 페이지 URL을 제시하세요. 출처 링크가 재게시 허가를 뜻하지 않음을 imageNote에 명시하세요. 사용 허가 불명인 이미지는 자동 저장 대상이 아니고 검토용으로 남습니다. AI로 가짜 제품 사진을 만드는 식으로 대체하지 마세요.
- 개념을 시각화하는 게 적절할 때만 imageMode='ai_concept'. imagePrompt는 거짓 브랜드 로고·실제 앱 화면·실제 사람 재현을 피하는 구체적인 비주얼 생성 지시문, imageNote는 AI 콘셉트 이미지 표기. 실제 이미지가 필요한 콘텐츠를 AI 이미지로 위장하지 마세요.
- 이미지가 정보 전달에 불필요하면 imageMode='none', layout='text'.
- layout은 text/image/split/background 중 하나. background는 첫 카드에서만 가능. 최소한 표지 한 장은 image 또는 split 또는 background 이미지 배치를 적극 고려하되 허위 시각자료는 만들지 마세요.
- sourceUrls는 뉴스 사실 검증 URL, imageSourceUrl은 실제 물체의 출처. 업로드하지 않은 이미지에는 imagePath/imageUrl을 만들어 넣지 마세요.
- caption은 사용자가 그대로 게시할 완결된 문장과 출처, 참여 유도 질문을 포함해야 합니다.
JSON만 출력하세요. 정확한 형식:
{"trends":[{"title":"트렌드","category":"LIFESTYLE","summary":"확인된 사실","whyNow":"지금 중요한 이유","buzzScore":85,"valueScore":80,"sourceUrls":["https://..."],"draft":{"caption":"후킹, 팩트, 질문, 출처","hashtags":"#태그1 #태그2 #태그3","slides":[{"kicker":"HOOK","title":"...","body":"...","layout":"background","imageMode":"official_image","imagePrompt":"exact product English search terms","imageSourceUrl":"https://...","imageNote":"사용권한 확인 필요"},{"kicker":"FACT","title":"...","body":"...","layout":"text","imageMode":"none"}]}}]}
각 draft의 slides는 위 예시처럼 필드를 갖춘 정확히 5개입니다. 데이터 외에 해설·마크다운 코드블록을 출력하지 마세요.`;
}
