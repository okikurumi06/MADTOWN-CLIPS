// src/app/admin/page.tsx
"use client";
import { useState } from "react";
import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ここで入力パスワードをサーバーに送る（サーバー側で ADMIN_PASSWORD と照合）
        body: JSON.stringify({ password: inputPassword }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || "ログインに失敗しました。");
        setAuthenticated(false);
      } else {
        // サーバーが httpOnly Cookie を設定するので、ここでは state を立てるだけ
        setAuthenticated(true);
      }
    } catch (e) {
      console.error(e);
      setError("サーバーエラーが発生しました。");
      setAuthenticated(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gray-50">
        <div className="bg-white shadow-md rounded-lg p-6 w-80">
          <h1 className="text-xl font-semibold mb-4 text-center">
            管理ページログイン
          </h1>
          <input
            type="password"
            placeholder="パスワードを入力"
            value={inputPassword}
            onChange={(e) => setInputPassword(e.target.value)}
            className="border px-3 py-2 w-full rounded mb-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={submitting || inputPassword.length === 0}
            className="bg-purple-600 text-white w-full py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? "認証中…" : "ログイン"}
          </button>

          <p className="text-xs text-gray-400 mt-3 text-center">
            ※ サーバー環境変数 <code>ADMIN_PASSWORD</code> と照合します
          </p>
        </div>
      </div>
    );
  }

  // 認証済み：管理ダッシュボード表示
  return <AdminDashboard />;
}
