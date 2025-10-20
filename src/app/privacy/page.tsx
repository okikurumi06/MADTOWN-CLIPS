// src/app/privacy/page.tsx
export const metadata = {
  title: "プライバシーポリシー | MADTOWN CLIPS",
  description:
    "MADTOWN CLIPS のプライバシーポリシーです。収集する情報、利用目的、第三者提供、問い合わせ先について記載します。",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">プライバシーポリシー</h1>

      <p className="text-sm text-gray-500 mb-8">
        最終更新日：2025-10-20
      </p>

      <section className="space-y-6 text-gray-800 leading-relaxed">
        <p>
          MADTOWN CLIPS（以下「本サービス」）は、公開されている YouTube
          動画のメタデータ（タイトル・サムネイル・再生数等）を集約・表示する
          ファンメイドの非公式サイトです。本サービスはステークホルダー
          （主催者・参加配信者・所属企業・権利者等）に不利益を与える意図はなく、
          問題のある掲載が確認された場合は速やかに削除・修正対応を行います。
        </p>

        <h2 className="text-xl font-semibold">1. 収集する情報</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <b>公開情報の取得：</b> YouTube Data API から取得できる公開の動画情報
            （動画ID、タイトル、チャンネル名、サムネイルURL、再生回数、公開日時、動画の長さ 等）。
          </li>
          <li>
            <b>アクセスログ：</b> サーバの運用・セキュリティ・品質改善のために、
            アクセス日時・IPアドレス（ハッシュ化・短期保持）・User-Agent・リクエストURL 等の
            技術ログを保存することがあります。
          </li>
          <li>
            <b>クッキー等：</b> 本サービス自体は個人を特定するクッキーを積極的に発行しません。
            （将来、表示最適化や管理画面ログイン等が必要な場合に限り、最小限のクッキーを利用することがあります）
          </li>
        </ul>

        <h2 className="text-xl font-semibold">2. 利用目的</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>本サービスの提供、改善、品質管理、障害調査</li>
          <li>YouTube API クォータ管理・失敗率の監視</li>
          <li>不適切なコンテンツの調査・削除対応</li>
        </ul>

        <h2 className="text-xl font-semibold">3. 第三者提供</h2>
        <p>
          法令に基づく場合を除き、取得した情報を第三者に提供しません。
          なお、ホスティング・DB・CDN 等のインフラ（Vercel、Supabase など）に
          処理・保管を委託する場合があります。
        </p>

        <h2 className="text-xl font-semibold">4. 外部サービスへのリンク</h2>
        <p>
          本サービスは YouTube への外部リンクを含みます。各外部サイトの
          プライバシーポリシーはそれぞれの運営者により管理されます。
        </p>

        <h2 className="text-xl font-semibold">5. 権利者・当事者からの申立て</h2>
        <p>
          掲載内容に問題がある場合、以下の情報を添えてご連絡ください。確認後、迅速に対応します。
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>該当URL（動画詳細または一覧ページ）</li>
          <li>問題箇所の具体的な内容と理由</li>
          <li>差し止め・修正等のご要望</li>
        </ul>

        <h2 className="text-xl font-semibold">6. 個人情報の取り扱い</h2>
        <p>
          本サービスはユーザー登録機能を提供しておらず、氏名・住所・連絡先等の
          個人情報は収集していません。将来的に機能追加を行う場合は、改定後の
          ポリシーに従って適切に取得・管理します。
        </p>

        <h2 className="text-xl font-semibold">7. 改定</h2>
        <p>
          本ポリシーは必要に応じて改定されることがあります。重要な変更がある場合、
          本ページで周知します。
        </p>

        <h2 className="text-xl font-semibold">8. お問い合わせ</h2>
        <p>
          本ポリシーに関するお問い合わせは、以下のメールアドレスまでご連絡ください。<br />
          <a
            href="mailto:okikurumi2525@gmail.com"
            className="underline text-purple-700"
          >
            okikurumi2525@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
