//src/app/ranking/RankingContent.tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Video = {
  id: string;
  title: string;
  channel_name: string;
  view_count: number;
  like_count: number;
  thumbnail_url: string;
  published_at: string;
  is_short_final: boolean;
};

const LIMIT = 48;

export default function RankingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [period, setPeriod] = useState<"week" | "day" | "all">(
    (searchParams.get("period") as "week" | "day" | "all") || "week"
  );
  const [type, setType] = useState<"all" | "short" | "normal">(
    (searchParams.get("type") as "all" | "short" | "normal") || "all"
  );
  const [order, setOrder] = useState<"view_count" | "published_at">(
    (searchParams.get("order") as "view_count" | "published_at") || "view_count"
  );
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const updateURL = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams({
      period,
      type,
      order,
      q: query,
      page: String(page),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    router.replace(`/ranking?${sp.toString()}`);
  };

  const fetchData = async () => {
    setLoading(true);
    const endpoint = query
      ? `/api/search?q=${encodeURIComponent(query)}&type=${type}&order=${order}&page=${page}`
      : `/api/ranking?period=${period}&type=${type}&order=${order}&page=${page}&limit=${LIMIT}`;

    const res = await fetch(endpoint);
    const json = await res.json();

    setVideos(json.results || json.data || []);
    setTotalPages(json.totalPages || 1);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period, type, order, page]);

  const visiblePages = 7;
  let startPage = Math.max(1, page - Math.floor(visiblePages / 2));
  let endPage = Math.min(totalPages, startPage + visiblePages - 1);
  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }

  const goToPage = (num: number) => {
    if (num >= 1 && num <= totalPages) {
      setPage(num);
      updateURL({ page: num });
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 dark:bg-gray-900 dark:text-white min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
        MADTOWN 切り抜き動画ランキング & 検索
      </h1>

      {/* 🔍 検索バー */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <input
          type="text"
          placeholder="タイトルやチャンネル名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full sm:w-80 md:w-96
                     bg-white dark:bg-gray-800 dark:text-white"
        />
        <button
          onClick={() => {
            setPage(1);
            updateURL({ q: query, page: 1 });
            fetchData();
          }}
          className="px-4 py-2 rounded-lg transition w-full sm:w-auto
                     bg-purple-600 text-white hover:bg-purple-700
                     dark:bg-purple-500 dark:hover:bg-purple-400 dark:text-white"
        >
          検索
        </button>
      </div>

      {/* 🎞️ 動画タイプ切替 */}
      <div className="flex justify-center mb-4 gap-2 sm:gap-3 flex-wrap">
        {[
          { key: "all", label: "すべて" },
          { key: "short", label: "ショートのみ" },
          { key: "normal", label: "通常のみ" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setType(item.key as any);
              setPage(1);
              updateURL({ type: item.key, page: 1 });
            }}
            className={`px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
              type === item.key
                ? "bg-purple-600 text-white dark:bg-purple-500"
                : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 🕒 日間／週間／全体 切替 */}
      {!query && (
        <div className="flex justify-center mb-4 gap-2 sm:gap-3 flex-wrap">
          {[
            { key: "day", label: "日間" },
            { key: "week", label: "週間" },
            { key: "all", label: "全体" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPeriod(p.key as any);
                setPage(1);
                updateURL({ period: p.key, page: 1 });
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
                period === p.key
                  ? "bg-purple-600 text-white dark:bg-purple-500"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 📊 並び替え */}
      <div className="flex justify-center mb-6 gap-2 sm:gap-3 flex-wrap">
        {[
          { key: "view_count", label: "再生数順" },
          { key: "published_at", label: "投稿日順" },
        ].map((o) => (
          <button
            key={o.key}
            onClick={() => {
              setOrder(o.key as any);
              setPage(1);
              updateURL({ order: o.key, page: 1 });
            }}
            className={`px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
              order === o.key
                ? "bg-purple-600 text-white dark:bg-purple-500"
                : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 📺 コンテンツ */}
      {loading ? (
        <p className="text-center text-gray-500 dark:text-gray-400">読み込み中...</p>
      ) : videos.length === 0 ? (
        <p className="text-center text-gray-400">該当する動画がありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {videos.map((v, i) => (
            <a
              key={v.id}
              href={
                v.is_short_final
                  ? `https://www.youtube.com/shorts/${v.id}`
                  : `https://www.youtube.com/watch?v=${v.id}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition
                         bg-white dark:bg-gray-800"
            >
              <img
                src={v.thumbnail_url}
                alt={v.title}
                className="w-full aspect-[16/9] object-cover"
              />
              <div className="p-3 sm:p-4">
                {!query && order === "view_count" && (
                  <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-300 font-semibold mb-1">
                    #{(page - 1) * LIMIT + i + 1}
                  </p>
                )}
                <h2 className="font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 text-sm sm:text-base">
                  {v.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {v.channel_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  👁 {v.view_count.toLocaleString()}　👍 {v.like_count.toLocaleString()}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-400 mt-1">
                  {new Date(v.published_at).toLocaleDateString("ja-JP")}
                </p>

                {v.is_short_final && (
                  <span className="inline-block mt-2 text-[10px] bg-pink-600 text-white px-2 py-0.5 rounded">
                    Shorts
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* 📄 ページネーション */}
      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-2 mt-10 mb-24 select-none">
          <button
            onClick={() => goToPage(1)}
            disabled={page === 1}
            className={`px-2 py-1 text-lg ${
              page === 1
                ? "text-gray-400 cursor-not-allowed"
                : "hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            «
          </button>

          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className={`px-2 py-1 text-lg ${
              page === 1
                ? "text-gray-400 cursor-not-allowed"
                : "hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            ‹
          </button>

          {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((num) => (
            <button
              key={num}
              onClick={() => goToPage(num)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                num === page
                  ? "bg-purple-600 text-white dark:bg-purple-500"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className={`px-2 py-1 text-lg ${
              page === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            ›
          </button>

          <button
            onClick={() => goToPage(totalPages)}
            disabled={page === totalPages}
            className={`px-2 py-1 text-lg ${
              page === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            »
          </button>
        </div>
      )}

      {/* 👇 フッター */}
      <footer className="mt-10 mb-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        © 2025 <span className="font-medium">okikurumi</span> ·{" "}
        <a
          href="https://github.com/okikurumi06/madtown-clips"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700 dark:hover:text-gray-200 transition"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
