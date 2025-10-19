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

  // 🔄 URLパラメータから初期値を読み取る
  const [period, setPeriod] = useState<"week" | "day" | "all">(
    (searchParams.get("period") as "week" | "day" | "all") || "week"
  );
  const [type, setType] = useState<"all" | "short" | "normal">(
    (searchParams.get("type") as "all" | "short" | "normal") || "all"
  );
  const [order, setOrder] = useState<"view_count" | "published_at">(
    (searchParams.get("order") as "view_count" | "published_at") ||
      "view_count"
  );
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // 📦 URL更新
  const updateURL = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams({
      period,
      type,
      order,
      q: query,
      page: String(page),
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
    });
    router.replace(`/ranking?${sp.toString()}`);
  };

  // 📡 データ取得
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        MADTOWN 切り抜きランキング & 検索
      </h1>

      {/* 🔍 検索バー */}
      <div className="flex flex-col md:flex-row justify-center gap-3 mb-6">
        <input
          type="text"
          placeholder="タイトルやチャンネル名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full md:w-96"
        />
        <button
          onClick={() => {
            setPage(1);
            updateURL({ q: query, page: 1 });
            fetchData();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          検索
        </button>
      </div>

      {/* 🎞️ 動画タイプ切替 */}
      <div className="flex justify-center mb-4 gap-3 flex-wrap">
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
            className={`px-4 py-2 rounded-lg border ${
              type === item.key
                ? "bg-purple-600 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 🕒 日間／週間／全体 切替 */}
      {!query && (
        <div className="flex justify-center mb-4 gap-3 flex-wrap">
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
              className={`px-4 py-2 rounded-lg border ${
                period === p.key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 📊 並び替えボタン */}
      <div className="flex justify-center mb-6 gap-3">
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
            className={`px-4 py-2 rounded-lg border ${
              order === o.key
                ? "bg-purple-600 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 📺 コンテンツ */}
      {loading ? (
        <p className="text-center text-gray-500">読み込み中...</p>
      ) : videos.length === 0 ? (
        <p className="text-center text-gray-400">該当する動画がありません。</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition bg-white"
            >
              <img
                src={v.thumbnail_url}
                alt={v.title}
                className="w-full aspect-video object-cover"
              />
              <div className="p-3">
                {!query && order === "view_count" && (
                  <p className="text-sm text-gray-400 font-semibold">
                    #{(page - 1) * LIMIT + i + 1}
                  </p>
                )}
                <h2 className="font-semibold line-clamp-2 text-gray-800">
                  {v.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">{v.channel_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  👁 {v.view_count.toLocaleString()}　👍{" "}
                  {v.like_count.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
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
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => {
              setPage((p) => Math.max(p - 1, 1));
              updateURL({ page: Math.max(page - 1, 1) });
            }}
            disabled={page <= 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ← 前へ
          </button>

          <span className="text-sm text-gray-700">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => {
              setPage((p) => Math.min(p + 1, totalPages));
              updateURL({ page: Math.min(page + 1, totalPages) });
            }}
            disabled={page >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            次へ →
          </button>
        </div>
      )}

      {/* 👇 ページ下フッター（控えめな制作者表記） */}
      <footer className="mt-10 mb-4 text-center text-sm text-gray-500">
        © 2025{" "}
        <span className="font-medium">okikurumi</span> ·{" "}
        <a
          href="https://github.com/okikurumi06/madtown-clips"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700 transition"
        >
          GitHub
        </a>
      </footer>
    </main>

  );
}
