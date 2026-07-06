import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi, type SessionView } from '../api/client'

// 進階開團功能:公平讓分 + 顯示場數。開團期間可即時調整。
// 預設值幫團主填好(N=4、X=2),不用從 0 開始;團主可微調。
export function FairPlayCard({ sessionId, view }: { sessionId: string; view?: SessionView }) {
  const { t } = useTranslation()
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
      setMsg(t('FairPlayCard.saved'))
    } catch {
      setMsg(t('FairPlayCard.saveFailed'))
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
      <span className="font-bold text-gray-700">⚖️ {t('FairPlayCard.title')}</span>

      {/* 目前平均(永遠顯示,讓團主決定門檻前先看到) */}
      <div className="text-sm bg-brand-mint/30 rounded-2xl px-3 py-2">
        {view?.fair_active ? (
          <>{t('FairPlayCard.avgPrefix')} <b className="text-brand-pink">{view.fair_avg?.toFixed(1)}</b> {t('FairPlayCard.avgSuffix', { active: view.fair_active })}
            {fair && view?.fair_enforced && (
              <span className="block text-xs text-gray-500 mt-0.5">{t('FairPlayCard.enforcedPrefix')} <b>{view.fair_limit?.toFixed(0)}</b> {t('FairPlayCard.enforcedSuffix')}</span>
            )}
          </>
        ) : (
          <span className="text-gray-400">{t('FairPlayCard.noAvg')}</span>
        )}
      </div>

      {/* 公平讓分主開關 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-700 text-sm">{t('FairPlayCard.fairLabel')}</p>
          <p className="text-xs text-gray-400">{t('FairPlayCard.fairDesc')}</p>
        </div>
        <Toggle on={fair} onClick={() => setFair((v) => !v)} />
      </div>

      {fair && (
        <div className="space-y-3 pl-1 border-l-2 border-brand-pink/30">
          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs font-bold text-gray-600 flex-1">
              {t('FairPlayCard.graceLabel')}
              <span className="block font-normal text-gray-400">{t('FairPlayCard.graceHint')}</span>
            </label>
            <input
              type="number" min={0} max={50} value={grace}
              onChange={(e) => setGrace(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))}
              className="w-16 text-center border-2 border-gray-200 rounded-2xl py-1.5 font-bold focus:outline-none focus:border-brand-pink"
            />
          </div>
          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs font-bold text-gray-600 flex-1">
              {t('FairPlayCard.thresholdLabel')}
              <span className="block font-normal text-gray-400">{t('FairPlayCard.thresholdHint')}</span>
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
              <p className="text-amber-600">{t('FairPlayCard.notEnforcedHint')}</p>
            )}
            <p className="text-gray-400 mt-1">{t('FairPlayCard.autoAdjustHint')}</p>
          </div>

          <p className="pl-3 text-xs text-amber-600">{t('FairPlayCard.autoShowGames')}</p>
        </div>
      )}

      {/* 顯示場數(獨立開關;公平讓分開時鎖定為開) */}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-700 text-sm">{t('FairPlayCard.showGamesLabel')}</p>
          <p className="text-xs text-gray-400">{t('FairPlayCard.showGamesDesc')}</p>
        </div>
        <Toggle on={effShowGames} onClick={() => setShowGames((v) => !v)} disabled={fair} />
      </div>

      {/* 白話規則說明 */}
      <details className="text-xs text-gray-500 bg-gray-50 rounded-2xl p-3">
        <summary className="font-bold text-gray-600 cursor-pointer">📖 {t('FairPlayCard.howItWorks')}</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>• {t('FairPlayCard.rule1')}</p>
          <p>• {t('FairPlayCard.rule2a')}<b>{t('FairPlayCard.rule2b')}</b>{t('FairPlayCard.rule2c')}<b>{t('FairPlayCard.rule2d')}</b>{t('FairPlayCard.rule2e')}</p>
          <p>• {t('FairPlayCard.rule3a')}<b>{t('FairPlayCard.rule3b')}</b>{t('FairPlayCard.rule3c')}</p>
          <p>• {t('FairPlayCard.rule4')}</p>
          <p>• {t('FairPlayCard.rule5')}</p>
          <p>• {t('FairPlayCard.rule6')}</p>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
          {saving ? t('FairPlayCard.saving') : t('FairPlayCard.saveBtn')}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </div>
  )
}
