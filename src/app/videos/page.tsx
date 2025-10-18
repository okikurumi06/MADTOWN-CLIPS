//src/app/videos/page.tsx
"use client";

import { useEffect, useState } from "react";

type Video = {
  id: string;
  title: string;
  duration: string;
  is_short_final: boolean;
  published_at?: string;
  thumbnail_url?: string;
};

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/videos-list")
      .then((res) => res.json())
      .then((data) => {
        setVideos(data.videos || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 text-lg">読み込み中...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🎥 登録済み動画一覧（テスト用）</h1>
      <table className="min-w-full border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">#</th>
            <th className="p-2 border">サムネイル</th>
            <th className="p-2 border">タイトル</th>
            <th className="p-2 border">再生時間</th>
            <th className="p-2 border">Shorts判定</th>
            <th className="p-2 border">公開日</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v, i) => (
            <tr key={v.id} className={v.is_short_final ? "bg-green-50" : ""}>
              <td className="border p-2">{i + 1}</td>
              <td className="border p-2">
                {v.thumbnail_url ? (
                  <img
                    src={v.thumbnail_url}
                    alt={v.title}
                    className="w-24 rounded"
                  />
                ) : (
                  "なし"
                )}
              </td>
              <td className="border p-2">
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {v.title}
                </a>
              </td>
              <td className="border p-2">{v.duration}</td>
              <td className="border p-2 font-bold">
                {v.is_short_final ? "✅ Shorts" : "🎞️ 通常"}
              </td>
              <td className="border p-2">{v.published_at || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-gray-500 text-sm">
        ※このページはテスト・検証用です。外部には公開されません。
      </p>
    </div>
  );
}
