# 更新日誌

## 2026-09-11 — 自訂網域 host.badminton-tw.fyi + PNG 圖示 / OG 預覽卡

- 後台改走 `https://host.badminton-tw.fyi`(玩家端 `https://badminton-tw.fyi`、API `https://api.badminton-tw.fyi`);GitHub secrets `VITE_API_URL` / `VITE_BOOKING_URL` 已換
- `MovedNotice`:舊 `*.cloudfront.net` 網址開到 → 瀏覽器直接跳新網域同路徑;已安裝的 PWA(standalone)顯示全螢幕「網址搬家請到新網址重新登入/加到主畫面」提醒,可稍後
- PNG 圖示:192/512 + maskable + `apple-touch-icon` 180 滿版(iOS 不吃 SVG、透明角會變黑);manifest 改列 PNG
- `index.html` 補 description + `og:*` 預覽卡(`og-image.png` 1200×630)
- README 三語網址換新

## 2026-09-03 — 防呆確認、開團列表分「進行中/尚未開始」、顯示團內人數

- 防呆確認:「結束這場」「復原剛剛的結束」以及排點板/手動排的「上場」「排隊」,執行前都會先跳確認視窗(沿用既有 Confirm 元件),避免誤觸
- 首頁開團列表分成「進行中」與「尚未開始」兩區:開打時間(start_at)還沒到的團列在「尚未開始」(薰衣草紫底),時間到自動移到「進行中」(每分鐘重算)
- 開團列表每團顯示人數:全部成員(joined_count)與實際上場打過至少一場的人數(played_count,後端新欄位)
- 「進行中 · 已 X 分」補上單位 → 「X 分鐘」(zh-TW 文案)
- 超管頁「← 返回」改為「← 上一頁」:走瀏覽歷史返回,沒有上一頁才 fallback 回前台
- 後端配合:SessionSummary 新增 played_count;attachMemberCounts 對所有 open session 計算人數(原本只算開放報名的)
- 已結束的團也統計人數:團主歷史紀錄與超管「所有開團」列表都會顯示(結團後名單保留 ~90 天,期限內有資料;後端 attachMemberCounts 改為 allSessions 模式 + semaphore 16 限流)

## 2026-07-18 — 玩家端新增「開團」宣傳入口(成長)

- 臨打人前端(booking)右下角新增 app 級漂浮的圓形「🏸 開團」宣傳鈕 + 對話泡泡「你也想自己開團嗎?」;點擊在**新分頁**開啟開團後台(admin),讓臨打人也能自己揪團
- 出現在玩家端所有頁面(大廳 / 加入頁 / 場內);圓鈕上下漂浮 + 光暈呼吸,泡泡進頁先冒 6 秒、之後每 30 秒再冒一次,泡泡可按 ✕ 收起
- 導向網址走 `VITE_HOST_APP_URL`,未設則 fallback 到 CloudFront(`d1r9u0ja59y4rv.cloudfront.net`),換網域只改 env
- 視覺:pink-500→rose-500 漸層 + 白字文字陰影(WCAG AA 對比)、白色外環;三語系文案(繁中/EN/日)
- 註:此為玩家端功能,程式在 booking repo;此處為團主更新資訊同步記錄

## 2026-07-17 — 鎖定場地:團主可暫時擋住臨打人自助上場/排隊

- 每個場地卡新增 🔒「鎖定場地」/🔓「解鎖」切換鈕(團主專屬),鎖定中的卡片會顯示「🔒 已鎖定」badge + 紅色外框
- 鎖定後,**臨打人在玩家端**不能自助上場/排隊——按下去會提示「此場地已被團主鎖起來」;**團主本人仍可手動加人 / 用排點板排人**(鎖定只擋自助,不擋團主調度)
- 使用情境:某場剛結束、還沒人排,你要從別場湊四個人過來時,先鎖住避免大家看到空位一直搶上場;人喬好再解鎖
- 後端:`Court.locked` 欄位(未鎖定不寫入,向後相容);只攔玩家自助路徑(`join-playing`/`join-queue`),團主 `add-*`/`seat-*` 不受影響;鎖定/解鎖寫入操作紀錄(`lock_court`/`unlock_court`)
- 即時同步:沿用既有 WebSocket 廣播(`scope: court`),解鎖後玩家端幾乎即時恢復可上場
- 內部:更新資訊(changelog)改用 explicit key,之後新增條目免整體重編號

## 2026-07-11 — 語音播報:結束這場自動唸出下一組名單

- 場中管理頁 header 新增 🔊 語音播報開關(開啟時會唸一句測試語音,順便確認喇叭音量;狀態記在裝置上)
- 開啟後,**團主按「結束這場」**或**場上投票結束成功**時,團主裝置會播「登登登」三聲鐘聲 + 語音唸出:「N 號場結束,請排隊人員 ○○、○○ 上場打球」(場地有自訂名稱就唸名稱)
- 鐘聲用 Web Audio 即時合成、人名用瀏覽器內建語音,免音檔、離線可用;接藍牙喇叭即可全場廣播
- 播報語言跟隨介面語言(繁中/English/日本語)
- 防呆:同一場結束 15 秒內不重複播;「復原剛剛的結束」不會誤播
- 投票結束的偵測原理:收到 WebSocket `scope: 'game'` 廣播時,比對新舊場況,「排隊的人變成場上的人」= 該場剛輪替
- iPhone 相容:語音解鎖改成點擊當下同步過門檻(iOS 只承認手勢當下的第一句語音);`navigator.audioSession.type='playback'` 讓鐘聲無視靜音鍵(iOS 17+);speak 前先 resume 避免卡 paused
- 📱 iPhone 使用注意:開頁後按一次 🔊 或點一下畫面解鎖語音;iOS 16 以下靜音鍵撥回響鈴
- 播報唸兩次 + 佇列:多場地同時結束排隊逐一播不蓋台(speakOnce 以 onend/保險絲推進佇列)
- 語音語言 fallback:裝置沒該語言的語音(如 Windows 沒裝日文語言包)→ 自動退回 中文→英文 播,文案跟著換語言,不靜音漏播
- 偵測 LINE/FB/IG 內建瀏覽器(語音常整組壞)→ 開啟 🔊 時提醒改用 Safari/Chrome;臨時診斷頁 /tts-diag.html
- 背景保活:開著播報時自動 Screen Wake Lock(螢幕不自動鎖)+ 循環近無聲音軌讓系統把頁面當「播音樂中」,手動關螢幕也盡量不凍結(效果視機型);副作用是藍牙喇叭不會閒置自動關機;鎖屏/通知中心會顯示「🏸 羽球場語音播報待命中」

## 2026-07-06 — 多語系支援

- 新增 English / 日本語 介面(react-i18next),右上角 🌐 切換
- 語言偏好記在裝置上,預設繁體中文
- README 三語版本(README.md / README.en.md / README.ja.md)
