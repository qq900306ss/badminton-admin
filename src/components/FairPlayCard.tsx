import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi, type SessionView } from '../api/client'

// 進階開團功能:公平讓分 + 顯示場數。開團期間可即時調整。
// 預設值幫團主填好(N=4、X=2),不用從 0 開始;團主可微調。
export function FairPlayCard({ sessionId, view }: { sessionId: string; view?: SessionView }) {
  const qc = useQueryClient()
  // 模式每次開啟設定都用伺服器最新值初始化(modal 條件渲染 → 每次重新 mount)
  const [fair, setFair] = useState(!!view?.fair_play)
  const [showGames, setShowGames] = useState(!!view?.show_games)
  const [grace, setGrace] = useState(view?.fair_grace_games || 4) // 預設寬限 4 場
  const [thr, setThr] = useState(view?.fair_threshold || 2) // 預設高於平均 2 場
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const effShowGames = fair || showGames // 公平讓分一開,顯示場數強制開

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      await sessionApi.setAdvanced(sessionId, {
        fair_play: fair,
        show_games: effShowGames,
        fair_grace_games: grace,
        fair_threshold: thr,
      })
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      setMsg('已儲存 ✓')
    } catch {
      setMsg('儲存失敗,請再試一次')
    } finally {
      setSaving(false)
    }
  }

  const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        on ? 'bg-brand-pink' : 'bg-gray-300'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )

  return (
    <div className="card space-y-3">
      <span className="font-bold text-gray-700">⚖️ 進階:公平讓分</span>

      {/* 目前平均(永遠顯示,讓團主決定門檻前先看到) */}
      <div className="text-sm bg-brand-mint/30 rounded-2xl px-3 py-2">
        {view?.fair_active ? (
          <>目前大家平均 <b className="text-brand-pink">{view.fair_avg?.toFixed(1)}</b> 場(在輪 {view.fair_active} 人)
            {fair && view?.fair_enforced && (
              <span className="block text-xs text-gray-500 mt-0.5">→ 打超過 <b>{view.fair_limit?.toFixed(0)}</b> 場的人現在會被擋</span>
            )}
          </>
        ) : (
          <span className="text-gray-400">還沒有人開始打,暫時沒有平均</span>
        )}
      </div>

      {/* 公平讓分主開關 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-700 text-sm">公平讓分</p>
          <p className="text-xs text-gray-400">擋住打太多的人,讓打少的人有得打</p>
        </div>
        <Toggle on={fair} onClick={() => setFair((v) => !v)} />
      </div>

      {fair && (
        <div className="space-y-3 pl-1 border-l-2 border-brand-pink/30">
          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs font-bold text-gray-600 flex-1">
              寬限場數
              <span className="block font-normal text-gray-400">打滿這場數前不受限</span>
            </label>
            <input
              type="number" min={0} max={50} value={grace}
              onChange={(e) => setGrace(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))}
              className="w-16 text-center border-2 border-gray-200 rounded-2xl py-1.5 font-bold focus:outline-none focus:border-brand-pink"
            />
          </div>
          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs font-bold text-gray-600 flex-1">
              高於平均幾場才擋
              <span className="block font-normal text-gray-400">越小越嚴格</span>
            </label>
            <input
              type="number" min={0} max={50} value={thr}
              onChange={(e) => setThr(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))}
              className="w-16 text-center border-2 border-gray-200 rounded-2xl py-1.5 font-bold focus:outline-none focus:border-brand-pink"
            />
          </div>

          {/* 即時狀態(平均已顯示在卡片上方) */}
          <div className="pl-3 text-xs text-gray-500">
            {!view?.fair_enforced && (
              <p className="text-amber-600">目前在輪人數不足(需 ≥ 5 人)或剛存檔,暫時不會擋任何人,人多了才生效。</p>
            )}
            <p className="text-gray-400 mt-1">數字會隨大家場數上升自動調整,被擋的人等別人追上就自動恢復。</p>
          </div>

          <p className="pl-3 text-xs text-amber-600">已自動開啟「顯示場數」(公平讓分需要讓大家看到場數才公平)。</p>
        </div>
      )}

      {/* 顯示場數(獨立開關;公平讓分開時鎖定為開) */}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-700 text-sm">顯示場數給臨打人</p>
          <p className="text-xs text-gray-400">前台會看到每個人打了幾場</p>
        </div>
        <Toggle on={effShowGames} onClick={() => setShowGames((v) => !v)} disabled={fair} />
      </div>

      {/* 白話規則說明 */}
      <details className="text-xs text-gray-500 bg-gray-50 rounded-2xl p-3">
        <summary className="font-bold text-gray-600 cursor-pointer">📖 這功能怎麼運作?(點開看)</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>• 開啟後,系統自動算出「打最多的那群人」的平均場數。</p>
          <p>• 當有人打超過「<b>平均 + 你設的場數</b>」時,他就<b>暫時不能上場、也不能排候補</b>,要讓打比較少的人先打。</p>
          <p>• 等大家追上、他不再超標,就<b>自動恢復</b>,不用你手動解除。</p>
          <p>• 還沒打滿「寬限場數」的人完全不受限(前面憑實力先搶 OK)。</p>
          <p>• 在輪人數少於 5 人時不啟用,避免場地空著沒人打。</p>
          <p>• 適合「最後一段時間想讓大家比較平均」時開啟,平常可關著。</p>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
          {saving ? '儲存中…' : '儲存設定'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </div>
  )
}
