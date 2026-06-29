// User-facing changelog shown in the「更新資訊」modal. Newest first. Keep entries
// short and in plain language (團主 audience).
export const CHANGELOG: { date: string; items: string[] }[] = [
  {
    date: '2026/06/29',
    items: [
      '開團時可直接選填「聯繫團主連結」;開團表單拿掉臨時加入(改成進場後再加)',
      '可在「⚙️ 設定」放「聯繫團主連結」(LINE 群、報名表等),臨打人首頁就能一鍵聯繫',
      '球場狀態改成即時同步,操作更省流量',
      '密碼 / 時間 / 改團名 收進「⚙️ 設定」',
      '可投票結束場地;結束與還原可同時操作',
      '臨打費標記 + 「只看沒繳錢」過濾',
      '家人帶人需團主核准、成員管理可看頭像',
      '縣市選好會出現對應的「區」下拉',
      '有新版本會自動提醒更新',
    ],
  },
]
