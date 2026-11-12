import { NextResponse } from 'next/server';

// Deliberately disabled: do not invoke paid model/image APIs from Trend Studio.
export async function GET() {
  return NextResponse.json({ error: '서버 AI 자동 제작 기능이 비활성화되어 있습니다.' }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: '서버 AI 자동 제작 기능이 비활성화되어 있습니다.' }, { status: 410 });
}
