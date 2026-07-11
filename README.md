# badminton-admin — 團主 / 超級管理員後台

**中文** · [English](README.en.md) · [日本語](README.ja.md)

羽球場地管理系統的後台:Google 登入 → 開團(設名稱/時間/密碼/球場/名單)→ QR code → 場中管理(換場、踢人、加人、改程度)→ 數據統計。超級管理員可管理團主、模擬登入。

🔗 **線上**:https://d1r9u0ja59y4rv.cloudfront.net
📋 [更新日誌](CHANGELOG.md)

## 相關

| | 網址 |
|--|------|
| 臨打人前端 (booking) | https://d2mg2bpjvlg672.cloudfront.net |
| 後端 API | https://pp2p4ln2cogxt4mi5f2wl3rqi40vskvs.lambda-url.ap-northeast-1.on.aws |

## 本機開發

```bash
npm install
npm run dev   # http://localhost:5173(須為 5173,對應 Google OAuth redirect)
```

## 部署

push 到 `main` → GitHub Actions 自動 build 並上傳 S3 + invalidate CloudFront。
完整部署說明見 `../DEPLOY.md`。
