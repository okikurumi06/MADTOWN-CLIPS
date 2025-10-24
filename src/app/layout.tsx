// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "MADTOWN CLIPS",
  description: "MADTOWN切り抜き動画ランキング & 検索サイト",
  openGraph: {
    title: "MADTOWN CLIPS｜MADTOWN切り抜き動画まとめサイト",
    description: "MADTOWNの切り抜き動画を人気順・再生数順でチェックできます。",
    url: "https://madtown-clips.vercel.app",
    siteName: "MADTOWN CLIPS",
    images: [
      {
        url: "/ogp.jpg", // ← publicフォルダに配置した画像
        width: 1200,
        height: 630,
        alt: "MADTOWN CLIPS サイトサムネイル",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MADTOWN CLIPS",
    description: "MADTOWN切り抜き動画まとめ・人気ランキングサイト",
    images: ["/ogp.jpg"],
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
