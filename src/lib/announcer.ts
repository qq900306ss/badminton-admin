// 語音播報:結束這場(團主按鈕 or 場上投票成功)→「登登登」+ 唸出下一組上場名單。
// 全用瀏覽器內建能力:Web Audio 合成三聲鐘聲(不用音檔)+ speechSynthesis 唸人名,
// 離線可用;聲音從團主裝置出 → 接藍牙小喇叭全場都聽得到。
import i18n from '../i18n'
import type { SessionView, CourtView } from '../api/client'

const KEY = 'announce' // localStorage:'1' 開/其他 關。預設關 — 開啟需要使用者手勢解鎖聲音

let ctx: AudioContext | null = null

// LINE/FB/IG 的內建瀏覽器(iOS 上是 WKWebView):Web Audio 鐘聲會響,但
// speechSynthesis 很常整組壞掉或不存在 → 症狀是「只有登登登沒人聲」。
// 偵測到就提醒團主改用 Safari/Chrome 開。
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent
  if (/Line\//i.test(ua)) return 'LINE'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/MicroMessenger/i.test(ua)) return 'WeChat'
  return null
}

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

// ---- 背景保活:螢幕鎖定/關閉後盡量讓播報還能出聲 ----
// 鎖屏後瀏覽器會凍結網頁(WS 斷、播報停),這是平台限制。但「正在播音訊」的
// 網頁會被當成音樂 App 繼續跑 → 掛一條循環的近無聲音軌保活。副作用是好的:
// 藍牙喇叭持續有訊號,不會閒置自動關機。另拿 Screen Wake Lock 讓螢幕不自動
// 鎖(保底;手動按電源鍵關屏才會走到音軌保活那條,各機型/iOS 版本效果有差)。

// 1 秒 8kHz 16-bit mono,振幅 1/32767(約 -90dB,聽不到但不是全 0 —
// 全 0 有機會被系統判定「沒在播」而照樣掛起)
function silentWavUrl(): string {
  const rate = 8000
  const n = rate
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, 1, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

interface WakeLockSentinelLike { release(): Promise<void> }
interface WakeLockLike { request(type: 'screen'): Promise<WakeLockSentinelLike> }

let keepAlive: HTMLAudioElement | null = null
let wakeLock: WakeLockSentinelLike | null = null
let onVisible: (() => void) | null = null

async function acquireWakeLock() {
  const wl = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock
  if (!wl) return
  try {
    wakeLock = await wl.request('screen')
  } catch {
    /* 低電量模式等情況會拒絕,不影響其他功能 */
  }
}

// 需在使用者手勢裡呼叫(audio.play 的 autoplay 限制)
export function startBackgroundKeepAlive() {
  if (!keepAlive) {
    claimPlaybackSession()
    keepAlive = new Audio(silentWavUrl())
    keepAlive.loop = true
  }
  void keepAlive.play().catch(() => {})
  // 鎖屏畫面/通知中心會顯示成正在播放的媒體,給個像樣的標題
  const ms = navigator.mediaSession
  if (ms && 'MediaMetadata' in window) {
    try {
      ms.metadata = new MediaMetadata({ title: i18n.t('Announce.mediaTitle') })
    } catch {
      /* ignore */
    }
  }
  void acquireWakeLock()
  // wake lock 在切走/鎖屏時會被系統收回,回到前景要重新拿
  if (!onVisible) {
    onVisible = () => {
      if (document.visibilityState === 'visible' && isAnnounceOn()) void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
  }
}

export function stopBackgroundKeepAlive() {
  keepAlive?.pause()
  void wakeLock?.release().catch(() => {})
  wakeLock = null
  if (onVisible) {
    document.removeEventListener('visibilitychange', onVisible)
    onVisible = null
  }
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
    startBackgroundKeepAlive() // 重新整理後開關本來就開著 → 這一下順便把保活掛回去
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

const LANG_TAG: Record<string, string> = { 'zh-TW': 'zh-TW', en: 'en-US', ja: 'ja-JP' }

// 瀏覽器的語音是跟作業系統要的:Windows 沒裝日文語言包、Android 沒下載日文
// TTS 時,指定 ja-JP 會一片安靜(鐘聲照響)。與其靜音漏播,不如自動退回
// 裝置真的有語音的語言(介面語言 → 中文 → 英文),播報文案也跟著用該語言組。
function speakableLng(): string {
  const voices = window.speechSynthesis?.getVoices() ?? []
  if (!voices.length) return i18n.language // voices 還沒非同步載完,別亂 fallback
  const has = (lng: string) => {
    const tag = LANG_TAG[lng] ?? lng
    return voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(tag.slice(0, 2).toLowerCase()))
  }
  for (const lng of [i18n.language, 'zh-TW', 'en']) if (has(lng)) return lng
  return i18n.language
}

// 唸一句,唸完(或引擎死掉)才 resolve — 佇列靠這個逐一前進
function speakOnce(text: string, lng: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve()
    // 佇列輪到我們時引擎理應閒著;還有殘留就是卡住的舊句,清掉。
    // (iOS 雷:沒在講話時 cancel() 會吞掉下一句,所以有講/排隊才 cancel)
    if (synth.speaking || synth.pending) synth.cancel()
    synth.resume() // iOS 偶爾卡在 paused 狀態,speak 會默默排隊不出聲 — 先喚醒
    const u = new SpeechSynthesisUtterance(text)
    const lang = LANG_TAG[lng] ?? 'zh-TW'
    u.lang = lang
    const v = pickVoice(lang)
    if (v) u.voice = v
    u.rate = 0.95 // 稍慢一點點,吵雜球場裡人名聽得更清楚
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    u.onend = finish
    u.onerror = finish
    // 保險絲:引擎沒回 onend 也要讓佇列前進(以字數估一句話最長多久)
    setTimeout(finish, 4000 + text.length * 350)
    synth.speak(u)
  })
}

// ---- 播報佇列:兩個場地幾乎同時結束時排隊逐一播,不互相蓋台;每則唸兩次 ----
interface AnnounceJob { text: string; lng: string; repeat: number }
const jobs: AnnounceJob[] = []
let pumping = false

async function pump() {
  if (pumping) return
  pumping = true
  while (jobs.length) {
    const job = jobs.shift()!
    await chime()
    for (let i = 0; i < job.repeat; i++) {
      await speakOnce(job.text, job.lng)
      if (i < job.repeat - 1) await new Promise((r) => setTimeout(r, 500))
    }
  }
  pumping = false
}

function enqueue(text: string, lng: string, repeat: number) {
  jobs.push({ text, lng, repeat })
  void pump()
}

// 開啟時在使用者手勢裡呼叫:同步解鎖 AudioContext + 語音(iOS 過了點擊當下
// 就不認帳),再登登登 + 唸一句測試,順便讓團主確認喇叭音量
export function unlockAndTest() {
  getCtx()
  primeSpeech()
  const lng = speakableLng()
  enqueue(i18n.getFixedT(lng)('Announce.enabled'), lng, 1)
}

// 同一個結束會從兩條路進來(團主按鈕的 onSuccess + 伺服器 WS 廣播的 diff),
// 用 court_id + 時間窗擋重複播;正常兩場之間隔好幾分鐘,15 秒很安全
const recent = new Map<string, number>()

export function announceCourtEnd(
  courtId: string,
  court: Pick<CourtView, 'name' | 'court_num'>,
  names: string[]
) {
  if (!isAnnounceOn()) return
  const now = Date.now()
  if (now - (recent.get(courtId) ?? 0) < 15000) return
  recent.set(courtId, now)
  // 文案用「裝置真的唸得出來」的語言組(介面日文但沒裝日文語音 → 退回中文)
  const lng = speakableLng()
  const ft = i18n.getFixedT(lng)
  const label = court.name?.trim() ? court.name : ft('Announce.courtN', { n: court.court_num })
  const opts = { interpolation: { escapeValue: false } } // 要唸的是純文字,別把人名 HTML 轉義
  const text = names.length
    ? ft('Announce.nextUp', { court: label, names: names.join(ft('Announce.nameSep')), ...opts })
    : ft('Announce.courtDone', { court: label, ...opts })
  enqueue(text, lng, 2) // 唸兩次,第一次沒聽清楚很正常
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
    announceCourtEnd(c.court_id, c, promoted.map((p) => p.display_name))
  }
}
