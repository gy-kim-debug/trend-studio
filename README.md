# Trend Studio

ChatGPT가 정리한 뉴스 원고를 인스타그램 4:5 카드뉴스로 편집하는 Next.js MVP입니다.

## 현재 기능

- 5장 카드뉴스의 제목/본문 편집
- 3종 비주얼 테마 선택
- 1080 × 1350 비율 미리보기
- PNG 개별 다운로드 및 ZIP 일괄 다운로드
- 샘플 콘텐츠 복원

## 실행

Node.js 20 이상에서 `npm install`, `npm run dev`를 실행합니다.

## v0.2: ChatGPT 원고 불러오기

화면 상단의 **JSON 가져오기**에서 원고를 붙여넣으면 5장 카드가 자동으로 채워집니다.
현재 편집 중인 원고를 JSON 파일로 내보낼 수도 있습니다.

원고 형식 예시:

```json
{
  "title": "새로운 AI 기술 발표",
  "category": "TECH / AI",
  "brand": "TREND BRIEF",
  "sourceUrls": ["https://example.org/press-release"],
  "slides": [
    { "kicker": "HOOK", "title": "첫 번째 카드", "body": "첫 번째 카드 설명" },
    { "kicker": "FACT", "title": "두 번째 카드", "body": "두 번째 카드 설명" },
    { "kicker": "CONTEXT", "title": "세 번째 카드", "body": "세 번째 카드 설명" },
    { "kicker": "IMPACT", "title": "네 번째 카드", "body": "네 번째 카드 설명" },
    { "kicker": "SUMMARY", "title": "다섯 번째 카드", "body": "다섯 번째 카드 설명" }
  ]
}
```

## v0.3: ChatGPT 직접 초안 등록 (설정 필요)

백엔드는 `POST /api/drafts`(등록)와 `GET /api/drafts`(최근 30개 조회)를 제공합니다.
API는 비밀 Bearer 토큰으로 보호되며, 본문 데이터는 검증한 뒤 Supabase에 저장합니다.
등록 후에도 상태는 `draft`이며 인스타그램에 자동 게시하지 않습니다.

1. Supabase 프로젝트를 만들고 `supabase/schema.sql`을 SQL Editor에서 실행합니다.
2. Vercel 프로젝트 Settings → Environment Variables에 `.env.example`의 3개 값을 등록합니다. `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저 코드나 GitHub에 추가하지 마세요.
3. Vercel을 재배포하고 Studio의 **서버 연결 토큰** 칸에 `TREND_STUDIO_API_TOKEN`을 입력한 후 저장된 초안을 조회해봅니다. 토큰은 페이지 메모리에만 유지됩니다.
4. ChatGPT의 Custom GPT Actions 설정에서 `https://trend-studio-eight.vercel.app/openapi.yaml`의 스키마를 가져오고 API Key 인증(Bearer)으로 같은 토큰을 설정합니다.
5. ChatGPT에 검증된 뉴스로 카드 5장 초안을 작성하고 **Trend Studio에 초안 등록**하라고 요청해 호출 결과를 확인합니다.

자동 예약 작업에서 Custom GPT Action을 무인 실행할 수 있다는 보장은 없습니다. 매일 자동 실행은 별도 검증이 필요하며, 외부 서비스 쓰기 요청에 사용자 승인이 요구될 수 있습니다.

## 범위 및 보안

- PNG 렌더링은 브라우저에서 이루어집니다.
- JSON 파일/텍스트 가져오기는 서버 설정 없이 동작하지만, 새로고침 시 편집 내용이 초기화됩니다.
- 외부 등록과 목록 조회는 Supabase 및 토큰 설정 이후에만 활성화됩니다.
- `card_drafts`는 RLS를 활성화하고 직접 클라이언트 접근 정책을 열지 않습니다.
- 서버 API 접근 토큰을 아는 사람은 초안 읽기·등록을 할 수 있으므로 길고 예측하기 어려운 값을 사용하고 외부에 공유하지 마세요.
- 사실 확인·저작권 검토·최종 게시는 관리자 책임으로 남겨둡니다.
