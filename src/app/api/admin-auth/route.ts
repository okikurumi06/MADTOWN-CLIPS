// src/app/api/admin-auth/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ ok: false, error: "パスワードが入力されていません。" }, { status: 400 });
    }

    // 🔐 サーバー環境変数のパスワードと照合
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("❌ 環境変数 ADMIN_PASSWORD が設定されていません。");
      return NextResponse.json({ ok: false, error: "サーバー設定エラー。" }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ ok: false, error: "パスワードが違います。" }, { status: 401 });
    }

    // ✅ Cookieにセッションを保存（1日有効）
    const res = NextResponse.json({ ok: true, message: "認証成功" });
    res.cookies.set("admin_session", "true", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24時間
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("❌ admin-auth error:", error);
    return NextResponse.json({ ok: false, error: "サーバーエラー" }, { status: 500 });
  }
}
