// src/app/ranking/page.tsx
import type { Metadata } from "next";
import RankingPageClient from "./RankingPageClient"; // ← クライアント部分を分離したファイル

export const metadata: Metadata = {
  title: "MADTOWN 切り抜きランキング | MADTOWN CLIPS",
  description: "MADTOWN切り抜き動画の人気ランキング。ショート・通常動画別に再生数順でチェックできます。",
  alternates: {
    canonical: "https://madtown-clips.vercel.app/ranking",
  },
  openGraph: {
    title: "MADTOWN 切り抜きランキング | MADTOWN CLIPS",
    description: "MADTOWN切り抜き動画の人気ランキング。ショート・通常動画別に再生数順でチェックできます。",
    url: "https://madtown-clips.vercel.app/ranking",
    siteName: "MADTOWN CLIPS",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RankingPage() {
  return <RankingPageClient />;
}
