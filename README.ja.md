# badminton-admin — 主催者 / スーパー管理者 管理画面

[中文](README.md) · [English](README.en.md) · **日本語**

バドミントンのコート管理システムの管理画面。Google ログイン → セッション作成（名前・時間・パスワード・コート・参加者リストを設定）→ QR コード → 開催中の管理（コート入れ替え、参加者の除外・追加、レベル変更）→ 統計。スーパー管理者は主催者の管理となりすましログインができます。

🔗 **本番**: https://d1r9u0ja59y4rv.cloudfront.net

## 関連

| | URL |
|--|------|
| 当日参加者フロントエンド (booking) | https://d2mg2bpjvlg672.cloudfront.net |
| バックエンド API | https://pp2p4ln2cogxt4mi5f2wl3rqi40vskvs.lambda-url.ap-northeast-1.on.aws |

## ローカル開発

```bash
npm install
npm run dev   # http://localhost:5173（Google OAuth のリダイレクトに合わせて 5173 必須）
```

## 多言語対応 (i18n)

UI は **繁体字中国語 / 英語 / 日本語** に対応しています。右上の 🌐 ピッカーで切り替えでき、選択は `localStorage` に保存されます。翻訳は `src/i18n/locales/*.json`（コンポーネントごとに `<Namespace>.<lang>.json` フラグメント）にあります。

## デプロイ

`main` に push → GitHub Actions が自動でビルドし、S3 にアップロード + CloudFront をキャッシュ無効化します。
詳細は `../DEPLOY.md` を参照してください。
