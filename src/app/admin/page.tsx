//src/app/admin/page.tsx
"use client";
import { useState, useEffect } from "react";
import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState("");

  const PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASS || "madtown123"; // 🔐 デフォルト仮パス

  useEffect(() => {
    const saved = localStorage.getItem("admin_auth");
    if (saved === "true") setAuthenticated(true);
  }, []);

  const handleLogin = () => {
    if (inputPassword === PASSWORD) {
      localStorage.setItem("admin_auth", "true");
      setAuthenticated(true);
    } else {
      setError("パスワードが違います");
    }
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
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
          />
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
          <button
            onClick={handleLogin}
            className="bg-purple-600 text-white w-full py-2 rounded hover:bg-purple-700"
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}
