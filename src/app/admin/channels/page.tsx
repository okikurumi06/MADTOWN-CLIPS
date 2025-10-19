// src/app/admin/channels/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Channel {
  id: string;
  name: string;
  active: boolean;
  video_count: number | null;
  last_checked: string | null;
}

export default function ChannelsAdminPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // 📦 初期ロード
  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    setLoading(true);
    const { data, error } = await supabase
      .from("madtown_channels")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setChannels(data);
    setLoading(false);
  }

  // ➕ 新規チャンネル追加
  async function addChannel() {
    if (!newId || !newName) return alert("IDと名前を入力してください");
    setAdding(true);
    const { error } = await supabase.from("madtown_channels").insert({
      id: newId.trim(),
      name: newName.trim(),
      active: true,
      created_at: new Date().toISOString(),
      video_count: 0,
    });
    setAdding(false);
    if (error) {
      alert("追加に失敗しました: " + error.message);
    } else {
      setNewId("");
      setNewName("");
      fetchChannels();
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">🎬 MADTOWN チャンネル管理</h1>

      {/* 📋 一覧 */}
      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <table className="w-full text-sm border border-gray-300 rounded-lg">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">チャンネル名</th>
              <th className="p-2">ID</th>
              <th className="p-2">Active</th>
              <th className="p-2">動画数</th>
              <th className="p-2">最終チェック</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id} className="border-t">
                <td className="p-2 font-medium">{ch.name}</td>
                <td className="p-2 text-gray-600">{ch.id}</td>
                <td className="p-2">{ch.active ? "✅" : "❌"}</td>
                <td className="p-2">{ch.video_count ?? "-"}</td>
                <td className="p-2 text-gray-500">
                  {ch.last_checked
                    ? new Date(ch.last_checked).toLocaleString("ja-JP")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ➕ 追加フォーム */}
      <div className="mt-8 border-t pt-6">
        <h2 className="font-semibold mb-3">新規チャンネル追加</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="チャンネルID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="flex-1 border p-2 rounded"
          />
          <input
            type="text"
            placeholder="チャンネル名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 border p-2 rounded"
          />
          <button
            onClick={addChannel}
            disabled={adding}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
          >
            {adding ? "追加中..." : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}
