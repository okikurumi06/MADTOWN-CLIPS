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
