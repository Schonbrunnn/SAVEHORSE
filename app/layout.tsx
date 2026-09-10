import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://baoma-zhilu-game.tender-hinny-0669.chatgpt.site'),
  title: '宝马之路',
  description: '前往国轩之窟、救出小马国公主的三关横屏格斗游戏。',
  openGraph: {
    title: '宝马之路',
    description: '选一位朋友，闯过小兵、秦岭杀人兔与草莓熊博士。',
    type: 'website',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: '宝马之路：前往国轩之窟，救出小马国公主' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '宝马之路',
    description: '穿过伏兵封锁，击败玥与珏，救出小马国公主。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
