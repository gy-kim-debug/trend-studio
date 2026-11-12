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

### v0.5: 트렌드 레이더 (설정 필요)

- 매일 **한국시간 오전 8시** Vercel Cron이 지난 48시간의 트렌드를 수집합니다. GitHub에 배포된 코드만으로 AI 검색이 실행되지는 않습니다.
- 정보 수집은 OpenAI Responses API의 웹 검색을 사용합니다. 일상 속보보다 **AI·테크 / 인터넷 문화 / 라이프스타일 / 브랜드 / 엔터테인먼트** 중심으로 1~3개 후보를 생성합니다.
- 각 후보에 **화제성·정보 가치(동일 가중치), 선정 이유, 출처 URL, 5장 카드 원고**를 담습니다. 모델 웹 검색에 등장하지 않은 URL은 허용하지 않습니다.
- 관리자 로그인 → **오늘의 트렌드 레이더** → **수집된 트렌드 보기** → 출처 확인 → **5장 카드 편집기로 가져오기** → 내용 수정 후 초안 저장·PNG 공유 순서입니다.
- 관리자가 **오늘 트렌드 수동 수집**을 누르면 하루 한 번만 실행됩니다. 자동 수집과 같은 날짜에는 중복 비용을 방지하기 위해 재실행하지 않습니다. 게시·인스타 업로드는 자동으로 하지 않습니다.

설정 순서:

1. Supabase SQL Editor에 `supabase/schema.sql`의 `trend_candidates` 테이블 생성 구문을 실행합니다. 기존 `card_drafts` 데이터는 유지됩니다.
2. Vercel Production 환경변수에 `OPENAI_API_KEY`와 충분히 긴 `CRON_SECRET`을 **Secret**으로 저장합니다. API 키는 [OpenAI API 플랫폼](https://platform.openai.com/)에서 별도로 발급받아야 하며 **ChatGPT Plus에 포함되지 않고 별도 요금**이 발생합니다.
3. `OPENAI_TREND_MODEL`은 기본 `gpt-6-astra`입니다. 변경 시 최신 모델의 웹 검색 지원 여부를 확인해주세요.
4. Vercel을 다시 배포하면 정기 작업이 활성화됩니다. 운영 전 API 사용량 한도와 결제 예산을 설정하고 관리자 화면에서 수동 수집을 한 번 시험해주세요.

오류 시에는 API 키 설정, 검색 모델 사용 권한, Supabase 테이블, Vercel Function 로그를 순서대로 확인하세요. AI가 만든 점수는 실제 SNS 조회수 데이터가 아닌 **편집 판단 점수**입니다. 검색 도구 출처가 있다고 해서 내용의 사실성이 보장되는 것은 아니므로 발행 전 수동 검수가 필수입니다.

### 관리자 로그인 설정

1. Supabase Authentication → Users에서 관리자 이메일 계정을 추가하고 이메일을 인증 처리합니다. 비밀번호는 Supabase에서 관리합니다.
2. Vercel Production 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`(Supabase Project URL), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(Supabase publishable key), `TREND_STUDIO_ADMIN_EMAIL`(관리자 이메일)을 등록한 뒤 재배포합니다.
3. Studio 상단 **관리자 스튜디오**에서 이메일/비밀번호로 로그인하면 저장된 초안 조회와 새 초안 저장 기능을 쓸 수 있습니다. 편집한 기존 게시글은 새 초안으로 저장되며, 기존 행 덮어쓰기/버전 관리는 후속 기능입니다.
4. 서버에서는 Supabase가 확인한 로그인 사용자 이메일이 관리자 이메일과 일치하는지 확인합니다. 기존 `TREND_STUDIO_API_TOKEN`은 ChatGPT Action 연동용으로 별도 유지됩니다.

- 브라우저에는 공개 가능한 Supabase URL/Publishable Key만 전달됩니다. `SUPABASE_SERVICE_ROLE_KEY`와 `TREND_STUDIO_API_TOKEN`은 서버 환경변수로만 유지하세요.
- 관리자 이메일은 단일 계정 기준입니다. 계정을 추가하려면 서버 권한 검증 구조를 확장해야 합니다.

- PNG 렌더링은 브라우저에서 이루어집니다.
- JSON 파일/텍스트 가져오기는 서버 설정 없이 동작하지만, 새로고침 시 편집 내용이 초기화됩니다.
- 외부 등록과 목록 조회는 Supabase 및 토큰 설정 이후에만 활성화됩니다.
- `card_drafts`는 RLS를 활성화하고 직접 클라이언트 접근 정책을 열지 않습니다.
- 서버 API 접근 토큰을 아는 사람은 초안 읽기·등록을 할 수 있으므로 길고 예측하기 어려운 값을 사용하고 외부에 공유하지 마세요.
- 사실 확인·저작권 검토·최종 게시는 관리자 책임으로 남겨둡니다.

## ChatGPT 예약 제작 원칙 (2026-11)

- 콘텐츠 조사와 이미지 생성은 **ChatGPT 예약 작업**에서 수행합니다. Trend Studio 서버는 유료 OpenAI API 기반 콘텐츠 생성 작업을 실행하지 않습니다.
- 과거의 서버 자동 수집 엔드포인트와 매일 실행 크론은 비활성화되었습니다. 관리자 화면의 서버 AI 수집 버튼도 제거했습니다.
- 현재 ChatGPT 예약 환경에서 Trend Studio 웹 관리자 화면을 자동 조작해 파일을 등록할 수 있는지는 별도로 연결·권한 확인이 필요합니다. 완료되지 않은 자동 연동을 성공이라고 표시하지 않습니다.
- JSON 수동 가져오기, 로그인, 이미지 직접 업로드, 내부 초안 저장 API는 기존대로 사용할 수 있습니다. 이는 모델 생성 API가 아닙니다.
