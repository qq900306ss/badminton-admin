// 語音播報:結束這場(團主按鈕 or 場上投票成功)→「登登登」+ 唸出下一組上場名單。
// 全用瀏覽器內建能力:Web Audio 合成三聲鐘聲(不用音檔)+ speechSynthesis 唸人名,
// 離線可用;聲音從團主裝置出 → 接藍牙小喇叭全場都聽得到。
import i18n from '../i18n'
import type { SessionView, CourtView } from '../api/client'

const KEY = 'announce' // localStorage:'1' 開/其他 關。預設關 — 開啟需要使用者手勢解鎖聲音

let ctx: AudioContext | null = null

export function isAnnounceOn(): boolean {
  return localStorage.getItem(KEY) === '1'
}

export function setAnnounceOn(on: boolean) {
  localStorage.setItem(KEY, on ? '1' : '0')
}

// iOS 17+:把網頁音訊宣告成「媒體播放」,否則 iPhone 側邊靜音鍵撥下去時
// Web Audio 的鐘聲會被當提示音整個吃掉(音樂類不會,但我們的登登登會)
interface AudioSessionLike { type: string }
function claimPlaybackSession() {
  const session = (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession
  if (session) {
    try {
      session.type = 'playback'
    } catch {
      /* 舊版不支援就算了 */
    }
  }
}

function getCtx(): AudioContext {
  if (!ctx) {
    claimPlaybackSession()
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// iOS 只承認「點擊當下」發出的第一句語音;晚 1 秒都不算,之後的語音全被吞。
// 所以解鎖必須同步做:在手勢 handler 裡立刻唸一個音量 0 的空句過門檻,
// 解鎖過一次後,這頁接下來的延遲語音(鐘聲後才開口)就都合法了。
let speechPrimed = false
function primeSpeech() {
  const synth = window.speechSynthesis
  if (!synth || speechPrimed) return
  synth.getVoices() // 觸發 voices 非同步載入
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
  speechPrimed = true
}

// 瀏覽器 autoplay 政策:重新整理後 AudioContext / speechSynthesis 要等頁面被點過
// 才准出聲。掛 pointerdown 把聲音偷偷解鎖,投票結束的播報(完全沒按任何鈕就要
// 出聲的路徑)才不會被吃掉。開關是關的就先不解鎖、繼續等(等到才卸監聽 —
// pointerdown 比 click 先發,開啟開關的那一下輪到這裡時 localStorage 還是關)。
export function primeOnFirstGesture() {
  const prime = () => {
    if (!isAnnounceOn()) return
    getCtx()
    primeSpeech()
    window.removeEventListener('pointerdown', prime)
  }
  window.addEventListener('pointerdown', prime)
  return () => window.removeEventListener('pointerdown', prime)
}

function tone(c: AudioContext, freq: number, at: number, dur: number, vol: number) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(vol, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, at + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + dur)
}

// 一下「登」= 基音 + 八度泛音 + 微失諧高泛音(敲擊感),仿顫音琴/車站鐘
function strike(c: AudioContext, freq: number, at: number, dur = 1.1) {
  tone(c, freq, at, dur, 0.45)
  tone(c, freq * 2, at, dur * 0.5, 0.12)
  tone(c, freq * 2.99, at, dur * 0.27, 0.05)
}

// 登登登:C5→E5→G5 三聲上行,仿賣場/車站廣播提示音。回傳 Promise 好讓語音接在
// 後面(尾音還在響時就開始講,跟真的廣播一樣,不用等到全靜)
function chime(): Promise<void> {
  const c = getCtx()
  const t0 = c.currentTime + 0.05
  strike(c, 523.25, t0)
  strike(c, 659.25, t0 + 0.28)
  strike(c, 783.99, t0 + 0.56, 1.6) // 最後一聲拉長收尾
  return new Promise((r) => setTimeout(r, 1300))
}

// 同一支裝置常同時裝著好幾個品質差很多的語音(Windows 的舊 SAPI vs Google/
// 微軟 Natural 線上語音),別拿到第一個就用 — 照品質特徵打分挑最好的
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  const cands = voices.filter((v) => norm(v.lang).startsWith(lang.slice(0, 2).toLowerCase()))
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|online/i.test(v.name) ? 8 : 0) + // 微軟 Natural 系,雲端神經語音
    (/google/i.test(v.name) ? 4 : 0) + // Chrome 的 Google 語音,比系統舊語音好
    (/premium|enhanced|siri/i.test(v.name) ? 3 : 0) + // iOS/macOS 高品質語音
    (norm(v.lang) === lang.toLowerCase() ? 2 : 0) // 完全對上地區(zh-TW ≠ zh-CN)
  return cands.sort((a, b) => score(b) - score(a))[0]
}

function speak(text: string) {
  const synth = window.speechSynthesis
  if (!synth) return
  // 舊播報還沒唸完就來新的 → 蓋掉,名單以最新為準。iOS 有個雷:沒在講話時
  // cancel() 會連下一句 speak 一起吞掉,所以有東西在講/排隊才 cancel
  if (synth.speaking || synth.pending) synth.cancel()
  synth.resume() // iOS 偶爾卡在 paused 狀態,speak 會默默排隊不出聲 — 先喚醒
  const u = new SpeechSynthesisUtterance(text)
  const lang =
    ({ 'zh-TW': 'zh-TW', en: 'en-US', ja: 'ja-JP' } as Record<string, string>)[i18n.language] ?? 'zh-TW'
  u.lang = lang
  const v = pickVoice(lang)
  if (v) u.voice = v
  u.rate = 0.95 // 稍慢一點點,吵雜球場裡人名聽得更清楚
  synth.speak(u)
}

// 開啟時在使用者手勢裡呼叫:同步解鎖 AudioContext + 語音(iOS 過了點擊當下
// 就不認帳),再登登登 + 唸一句測試,順便讓團主確認喇叭音量
export function unlockAndTest() {
  getCtx()
  primeSpeech()
  void chime().then(() => speak(i18n.t('Announce.enabled')))
}

function labelOf(court: Pick<CourtView, 'name' | 'court_num'>): string {
  return court.name?.trim() ? court.name : i18n.t('Announce.courtN', { n: court.court_num })
}

// 同一個結束會從兩條路進來(團主按鈕的 onSuccess + 伺服器 WS 廣播的 diff),
// 用 court_id + 時間窗擋重複播;正常兩場之間隔好幾分鐘,15 秒很安全
const recent = new Map<string, number>()

export function announceCourtEnd(courtId: string, courtLabel: string, names: string[]) {
  if (!isAnnounceOn()) return
  const now = Date.now()
  if (now - (recent.get(courtId) ?? 0) < 15000) return
  recent.set(courtId, now)
  const opts = { interpolation: { escapeValue: false } } // 要唸的是純文字,別把人名 HTML 轉義
  const text = names.length
    ? i18n.t('Announce.nextUp', { court: courtLabel, names: names.join(i18n.t('Announce.nameSep')), ...opts })
    : i18n.t('Announce.courtDone', { court: courtLabel, ...opts })
  void chime().then(() => speak(text))
}

// 投票結束沒有專屬 WS 事件 — 伺服器只廣播整份新 view(scope 'game')。套用前跟舊 view
// 比對:某場的新「場上」出現了舊「排隊」的人 = 剛輪替(結束→補位)→ 播報那幾位。
// 復原結束(undo)不會中:被還原的四人本來就不在排隊列裡。
export function announceRotations(prev: SessionView | undefined, next: SessionView) {
  if (!prev || !isAnnounceOn()) return
  const oldById = new Map(prev.courts.map((c) => [c.court_id, c]))
  for (const c of next.courts) {
    const o = oldById.get(c.court_id)
    if (!o) continue
    const oldQueue = new Set(o.queue.map((q) => q.player_id))
    const oldPlaying = new Set(o.playing.filter((p) => p.player_id).map((p) => p.player_id))
    const promoted = c.playing.filter(
      (p) => p.player_id && oldQueue.has(p.player_id) && !oldPlaying.has(p.player_id)
    )
    // 沒人排隊時結束(投票也可能):場上清空、也沒人補 → 只報「X 號場結束」
    const emptiedOut =
      promoted.length === 0 &&
      oldPlaying.size > 0 &&
      o.queue.length === 0 &&
      c.playing.every((p) => !p.player_id)
    if (promoted.length === 0 && !emptiedOut) continue
    announceCourtEnd(c.court_id, labelOf(c), promoted.map((p) => p.display_name))
  }
}
