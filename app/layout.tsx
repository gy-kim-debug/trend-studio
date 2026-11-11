import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trend Studio — 카드뉴스 제작기',
  description: '뉴스 원고를 인스타그램 캐러셀 이미지로 만드는 편집 스튜디오',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
