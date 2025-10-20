//src/app/ranking/page.tsx
import type { Metadata, ResolvingMetadata } from "next";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function generateMetadata(
  { searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const base = "https://madtown-clips.vercel.app";
  const period = (searchParams?.period as string) ?? "week";
  const type = (searchParams?.type as string) ?? "all";
  const order = (searchParams?.order as string) ?? "view_count";
  const page = Number(searchParams?.page ?? "1");
  const q = (searchParams?.q as string)?.trim() ?? "";

  const pieces: string[] = [];
  if (q) pieces.push(`「${q}」の検索結果`);
  pieces.push("MADTOWN 切り抜きランキング");
  const title = pieces.join(" | ");

  const desc = q
    ? `「${q}」を含むMADTOWN切り抜き動画の人気ランキング。動画タイプ: ${type}、期間: ${period}、並び順: ${order}（p.${page}）`
    : `MADTOWN切り抜き動画の人気ランキング。動画タイプ: ${type}、期間: ${period}、並び順: ${order}（p.${page}）`;

  const url = new URL(`${base}/ranking`);
  if (period !== "week") url.searchParams.set("period", period);
  if (type !== "all") url.searchParams.set("type", type);
  if (order !== "view_count") url.searchParams.set("order", order);
  if (q) url.searchParams.set("q", q);
  if (page > 1) url.searchParams.set("page", String(page));
  const canonical = url.toString();

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      siteName: "MADTOWN CLIPS",
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

"use client";

import { Suspense } from "react";
import RankingContent from "./RankingContent";

export default function RankingPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10">読み込み中...</div>}>
      <RankingContent />
    </Suspense>
  );
}
