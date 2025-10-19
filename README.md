# 🎬 MADTOWN CLIPS

> MADTOWN（マッドタウン）関連のYouTube切り抜き動画を自動収集し、  
> ランキング・検索表示を行うウェブアプリです。  
> 最新動画の自動取得、Shorts判定、ダッシュボード管理などが可能です。

---

## 🌐 サイトURL

🔗 [https://madtown-clips.vercel.app](https://madtown-clips.vercel.app)

---

## 🧠 主な機能

| 機能名 | 説明 |
|--------|------|
| 🎥 動画ランキング | YouTube Data APIから収集したMADTOWN関連動画をランキング表示 |
| 🔍 検索機能 | タイトル・チャンネル名で検索可能（ショート／通常動画の絞り込み対応） |
| ⚙️ 管理者ページ | 簡易パスワード認証付き。クォータ消費量グラフを表示 |
| 🕓 自動収集（cron対応） | `fetch-videos-hashtag` / `fetch-videos-diff` により定期収集 |
| 🩺 Shorts自動判定 | `/api/update-is-short-html` により動画HTMLを解析してShortsを自動判定 |

---

## 🏗️ 使用技術

| カテゴリ | 技術スタック |
|-----------|---------------|
| フロントエンド | Next.js 14 (App Router) / TypeScript / Tailwind CSS |
| データベース | Supabase (PostgreSQL + RLS) |
| API | YouTube Data API v3 |
| ホスティング | Vercel |
| グラフ描画 | Recharts |
| その他 | Cron Jobs / 環境変数でAPIキー切替制御 |

---

## ⚙️ 環境変数設定

プロジェクトルートに `.env.local` を作成し、以下の内容を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

YT_API_KEY=your_youtube_api_key
YT_API_KEY_BACKUP=your_backup_api_key
YT_API_KEY_BACKUP_2=your_backup_api_key_2

ADMIN_PASSWORD=your_admin_password
