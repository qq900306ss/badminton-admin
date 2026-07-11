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

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// 瀏覽器 autoplay 政策:重新整理後 AudioContext / speechSynthesis 要等頁面被點過
// 一次才准出聲。掛一個一次性的 pointerdown 把聲音偷偷解鎖,投票結束的播報
// (完全沒按任何鈕就要出聲的路徑)才不會被吃掉。
export function primeOnFirstGesture() {
  const prime = () => {
    if (isAnnounceOn()) {
      getCtx()
      window.speechSynthesis?.getVoices() // 順便觸發 voices 非同步載入
    }
  }
  window.addEventListener('pointerdown', prime, { once: true })
  return () => window.removeEventListener('pointerdown', prime)
}

// 登登登:C5→E5→G5 三聲上行,仿賣場/車站廣播提示音。回傳 Promise 好讓語音接在後面
function chime(): Promise<void> {
  const c = getCtx()
  const t0 = c.currentTime + 0.05
  ;[523.25, 659.25, 783.99].forEach((freq, i) => {
    const at = t0 + i * 0.24
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.5, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.55)
    osc.connect(gain).connect(c.destination)
    osc.start(at)
    osc.stop(at + 0.6)
  })
  return new Promise((r) => setTimeout(r, 1000))
}

function speak(text: string) {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel() // 舊播報還沒唸完就來新的 → 直接蓋掉,名單以最新為準
  const u = new SpeechSynthesisUtterance(text)
  const lang =
    ({ 'zh-TW': 'zh-TW', en: 'en-US', ja: 'ja-JP' } as Record<string, string>)[i18n.language] ?? 'zh-TW'
  u.lang = lang
  const voices = synth.getVoices()
  const v =
    voices.find((v) => v.lang.replace('_', '-') === lang) ??
    voices.find((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)))
  if (v) u.voice = v
  u.rate = 1
  synth.speak(u)
}

// 開啟時在使用者手勢裡呼叫:解鎖 AudioContext + 唸一句測試,順便讓團主確認喇叭音量
export function unlockAndTest() {
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
