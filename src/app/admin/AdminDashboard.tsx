//src/app/admin/AdminDashboard.tsx
"use client";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function AdminDashboard() {
  const [quotaData, setQuotaData] = useState<
    { date: string; usage: number }[]
  >([]);

  useEffect(() => {
    // 🔄 実データを取得
    fetch("/api/admin/quota")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setQuotaData(res.data);
        else console.error("quota fetch error", res.error);
      })
      .catch(console.error);
  }, []);


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-purple-700">
          MADTOWN 管理ダッシュボード
        </h1>
        <button
          onClick={() => {
            localStorage.removeItem("admin_auth");
            window.location.reload();
          }}
          className="text-sm text-gray-600 underline hover:text-gray-800"
        >
          ログアウト
        </button>
      </header>

      <section className="bg-white shadow p-6 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">📊 YouTube API クォータ使用量</h2>
        <p className="text-sm text-gray-500 mb-4">
          （※現在はテストデータ。実際のAPIリクエスト数を反映予定）
        </p>

        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={quotaData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="usage"
                stroke="#8b5cf6"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
