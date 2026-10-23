import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { sessionApi } from '../api/client'
import type { CourtView, PlayerSlot, SessionPlayer, SessionView } from '../api/client'
import { useSessionView, useSessionPlayers, useManageActions } from '../hooks/useApi'
import { StatsPanel } from '../components/StatsPanel'
import { ActionLogPanel } from '../components/ActionLogPanel'
import { SessionSummary } from '../components/SessionSummary'
import { PasswordCard } from '../components/PasswordCard'
import { TimesCard } from '../components/TimesCard'
import { LocationCard } from '../components/LocationCard'
import { ContactCard } from '../components/ContactCard'
import { AnnouncementCard } from '../components/AnnouncementCard'
import { FairPlayCard } from '../components/FairPlayCard'
import { SeatingBoard } from '../components/SeatingBoard'
import { SwapQueueModal } from '../components/SwapQueueModal'
import { SignupSettingsCard } from '../components/SignupSettingsCard'
import { SignupReviewPanel } from '../components/SignupReviewPanel'
import { useConfirm } from '../components/Confirm'
import { CourtSkeleton } from '../components/Skeleton'
import { LanguageRow } from '../components/LanguageSwitcher'
import { CourtTile } from '../components/manage/CourtTile'
import { RosterTab } from '../components/manage/RosterTab'
import { AddToCourtSheet, CourtMenuSheet, PlayerSheet } from '../components/manage/ActionSheets'
import { Sheet, SheetAction } from '../components/manage/Sheet'
import { connectSessionWS } from '../lib/realtime'
import { shareContent } from '../lib/share'
import { isAnnounceOn, setAnnounceOn, unlockAndTest, primeOnFirstGesture, announceCourtEnd, announceRotations, startBackgroundKeepAlive, stopBackgroundKeepAlive, inAppBrowser } from '../lib/announcer'

const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:5174'

// 同名的人給穩定編號(#1 #2),團主才分得出來;沒撞名回 {}
function dupOrdinals(players: SessionPlayer[]): Record<string, number> {
  const count: Record<string, number> = {}
  for (const p of players) count[p.display_name] = (count[p.display_name] ?? 0) + 1
  const seen: Record<string, number> = {}
  const out: Record<string, number> = {}
  for (const p of [...players].sort((a, b) => a.player_id.localeCompare(b.player_id))) {
    if (count[p.display_name] > 1) {
      seen[p.display_name] = (seen[p.display_name] ?? 0) + 1
      out[p.player_id] = seen[p.display_name]
    }
  }
  return out
}

// 手機優先的場內管理:底部四個分頁(場地 / 成員・收錢 / 邀請 / 更多)。
// 比賽中最常用的「場地」是預設分頁,一打開就是;危險操作(結束開團)收在「更多」最下面。
type Tab = 'courts' | 'roster' | 'invite' | 'more'
const TABS: Tab[] = ['courts', 'roster', 'invite', 'more']

export function SessionManagePage() {
  const { t } = useTranslation()
  const { sessionId } = useParams<{ sessionId: string }>()
  const nav = useNavigate()
  const sid = sessionId ?? ''
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'courts') as Tab
  const setTab = (k: Tab) => {
    const p = new URLSearchParams(params)
    if (k === 'courts') p.delete('tab')
    else p.set('tab', k)
    setParams(p, { replace: true })
    window.scrollTo({ top: 0 })
  }

  const [wsUp, setWsUp] = useState(false) // WS 活著 → 輪詢降頻成 60 秒對帳
  const { data: session, isLoading } = useSessionView(sid, wsUp)
  const { data: players } = useSessionPlayers(sid, wsUp)
  const actions = useManageActions(sid)
  const { endCourt, undoEnd, kick, addPlaying, addCourt, addPlayer, setLevel, setPlayerName, setPaid, approveFamily, renameCourt, removeCourt, addQueue, swapQueue, lockCourt, removePlayer } = actions
  const confirm = useConfirm()
  const qc = useQueryClient()

  // 報名中(等核准)的人只出現在報名審核區,不算成員
  const roster = useMemo(() => (players ?? []).filter((p) => !(p.pending && p.is_signup)), [players])
  const dup = useMemo(() => dupOrdinals(players ?? []), [players])
  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.player_id, p])), [players])

  // 鎖屏/切走時 WS 會被掐死 → 回到前景那一刻立刻對帳
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sid) {
        qc.invalidateQueries({ queryKey: ['session', sid] })
        qc.invalidateQueries({ queryKey: ['session-players', sid] })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sid, qc])

  // 即時:伺服器把最新 view/players 夾在 WS 訊息裡 → setQueryData;沒帶 payload 才 invalidate
  const lastApplied = useRef(0)
  const wasDown = useRef(false)
  useEffect(() => {
    if (!sid) return
    return connectSessionWS(
      sid,
      (m) => {
        if (m.t !== 'changed') return
        const inval = (k: string) => qc.invalidateQueries({ queryKey: [k, sid] })
        const scope = m.scope ?? 'all'
        if (m.view) {
          const at = m.at ?? Date.now()
          if (at >= lastApplied.current) {
            if (scope === 'game') announceRotations(qc.getQueryData<SessionView>(['session', sid]), m.view)
            lastApplied.current = at
            qc.setQueryData(['session', sid], m.view)
            if (m.players) qc.setQueryData(['session-players', sid], m.players)
          }
        } else {
          inval('session')
          if (scope !== 'court' && scope !== 'session') inval('session-players')
        }
        if (scope === 'game' || scope === 'all') inval('games')
        inval('action-logs')
      },
      (up) => {
        setWsUp(up)
        if (up && wasDown.current) {
          wasDown.current = false
          qc.invalidateQueries({ queryKey: ['session', sid] })
          qc.invalidateQueries({ queryKey: ['session-players', sid] })
        }
        if (!up) wasDown.current = true
      }
    )
  }, [sid, qc])

  // 語音播報開關
  const [announceOn, setAnnounceState] = useState(isAnnounceOn())
  useEffect(() => {
    const off = primeOnFirstGesture()
    return () => {
      off()
      stopBackgroundKeepAlive()
    }
  }, [])
  function toggleAnnounce() {
    const next = !announceOn
    setAnnounceOn(next)
    setAnnounceState(next)
    if (next) {
      unlockAndTest()
      startBackgroundKeepAlive()
      const app = inAppBrowser()
      if (app) alert(t('Announce.inAppWarn', { app }))
    } else {
      stopBackgroundKeepAlive()
    }
  }

  const [poster, setPoster] = useState(false)
  const [summary, setSummary] = useState(false)
  const [board, setBoard] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [titleErr, setTitleErr] = useState('')
  const [playerSheet, setPlayerSheet] = useState<string | null>(null) // player_id
  const [addTarget, setAddTarget] = useState<{ courtId: string; mode: 'playing' | 'queue' } | null>(null)
  const [menuCourt, setMenuCourt] = useState<string | null>(null)
  const [swapSource, setSwapSource] = useState<string | null>(null)

  async function saveTitle() {
    const v = titleInput.trim()
    if (!v) return
    setTitleErr('')
    try {
      await sessionApi.setTitle(sid, v)
      qc.invalidateQueries({ queryKey: ['session', sid] })
      setEditTitle(false)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setTitleErr(m ?? t('SessionManagePage.titleSaveFailed'))
    }
  }

  const joinUrl = `${BOOKING_URL}/?s=${sid}`
  async function closeSession() {
    if (!(await confirm({ message: t('SessionManagePage.confirmCloseMessage'), confirmText: t('SessionManagePage.endSession'), danger: true }))) return
    await sessionApi.close(sid)
    setSummary(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg p-4">
        <CourtSkeleton />
      </div>
    )
  }

  const courts = session?.courts ?? []
  const courtTitle = (c: CourtView) => (c.name?.trim() ? c.name : t('Manage.courtN', { n: c.court_num }))
  // 每個人現在在哪(場上 / 排隊),一人只能在一個場地
  const where = new Map<string, { court: CourtView; playing: boolean }>()
  for (const c of courts) {
    c.playing.forEach((s) => s.player_id && where.set(s.player_id, { court: c, playing: true }))
    c.queue.forEach((s) => where.set(s.player_id, { court: c, playing: false }))
  }
  const free = (players ?? []).filter((p) => !where.has(p.player_id) && !p.pending)
  const sheetPlayer = playerSheet ? (byId.get(playerSheet) ?? null) : null
  const sheetWhere = playerSheet ? where.get(playerSheet) : undefined
  const addCourtObj = addTarget ? courts.find((c) => c.court_id === addTarget.courtId) : undefined
  const menuCourtObj = menuCourt ? (courts.find((c) => c.court_id === menuCourt) ?? null) : null

  const playingCourts = courts.filter((c) => c.playing.filter((s) => s.player_id).length === 4).length
  const queued = courts.reduce((n, c) => n + c.queue.length, 0)
  const idle = roster.filter((p) => p.claimed && !where.has(p.player_id)).length
  const pendingSignups = (players ?? []).filter((p) => p.pending && p.is_signup).length

  async function endOne(court: CourtView) {
    if (!(await confirm({ message: t('SessionManagePage.confirmEndCourt', { name: courtTitle(court) }), confirmText: t('SessionManagePage.confirmEndCourtBtn') }))) return
    const snap = { name: court.name, court_num: court.court_num }
    const names = court.queue.map((q) => q.display_name)
    endCourt.mutate(court, { onSuccess: () => announceCourtEnd(court.court_id, snap, names) })
  }

  const NAV: { key: Tab; icon: string; label: string; badge?: number }[] = [
    { key: 'courts', icon: '🏸', label: t('Manage.tabCourts') },
    { key: 'roster', icon: '👥', label: t('Manage.tabRoster'), badge: pendingSignups || undefined },
    { key: 'invite', icon: '📲', label: t('Manage.tabInvite') },
    { key: 'more', icon: '⚙️', label: t('Manage.tabMore') },
  ]

  return (
    <div className="min-h-screen bg-[#FFF5F7] pb-28">
      {/* 頂端:返回 / 團名(點一下改)/ 語音 */}
      <header className="bg-white/90 backdrop-blur sticky z-20 px-3 py-2.5 flex items-center gap-2 border-b border-pink-50" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <button onClick={() => nav('/')} className="w-9 h-9 rounded-full text-gray-500 text-lg active:bg-gray-100" aria-label={t('SessionManagePage.back')}>
          ‹
        </button>
        <button
          onClick={() => {
            setTitleInput(session?.title ?? '')
            setTitleErr('')
            setEditTitle(true)
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block font-extrabold text-gray-900 text-[17px] truncate">
            {session?.title?.trim() ? session.title : t('SessionManagePage.untitledSession')}
          </span>
          <span className="block text-[11px] text-gray-400 truncate">
            {wsUp ? '🟢 ' : '⚪ '}
            {t('Manage.headerLine', { courts: courts.length, people: roster.length })}
          </span>
        </button>
        <button
          onClick={toggleAnnounce}
          aria-label={announceOn ? t('Announce.toggleTitleOn') : t('Announce.toggleTitleOff')}
          className={`h-9 px-3 rounded-full text-sm font-bold ${announceOn ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}
        >
          🔊 {announceOn ? t('Manage.on') : t('Manage.off')}
        </button>
      </header>

      {summary && (
        <SessionSummary
          sessionId={sid}
          title={session?.title ?? ''}
          players={players ?? []}
          onClose={() => {
            setSummary(false)
            if (session?.status === 'closed') nav('/')
          }}
        />
      )}

      <main className="max-w-xl mx-auto px-3 pt-3 space-y-3">
        {/* ===== 場地 ===== */}
        {tab === 'courts' && (
          <>
            {/* 現況一行:點了直接跳去處理 */}
            <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-0.5">
              {[
                { icon: '🏸', text: t('Manage.chipPlaying', { n: playingCourts, total: courts.length }) },
                { icon: '⏳', text: t('Manage.chipQueued', { n: queued }) },
                { icon: '🙋', text: t('Manage.chipIdle', { n: idle }) },
                ...(pendingSignups ? [{ icon: '📝', text: t('Manage.chipSignups', { n: pendingSignups }), go: 'roster' as Tab, hot: true }] : []),
              ].map((c) => (
                <button
                  key={c.text}
                  onClick={() => 'go' in c && c.go && setTab(c.go)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${'hot' in c && c.hot ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}
                >
                  {c.icon} {c.text}
                </button>
              ))}
            </div>

            {session?.announcement?.trim() && (
              <button onClick={() => setTab('more')} className="w-full text-left bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 text-xs text-amber-800 line-clamp-2">
                📢 {session.announcement}
              </button>
            )}

            {courts.map((court) => (
              <CourtTile
                key={court.court_id}
                court={court}
                stopAt={session?.end_at}
                onEnd={() => endOne(court)}
                onUndo={async () => {
                  if (!(await confirm({ message: t('SessionManagePage.confirmUndoEnd'), confirmText: t('SessionManagePage.confirmUndoEndBtn') }))) return
                  undoEnd.mutate(court.court_id)
                }}
                onMenu={() => setMenuCourt(court.court_id)}
                onSlot={(s: PlayerSlot) => setPlayerSheet(s.player_id)}
                onAddPlaying={() => setAddTarget({ courtId: court.court_id, mode: 'playing' })}
                onAddQueue={() => setAddTarget({ courtId: court.court_id, mode: 'queue' })}
              />
            ))}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addCourt.mutate()} className="py-3 rounded-2xl bg-white shadow-sm text-sm font-bold text-gray-600 active:scale-[0.98]">
                ＋ {t('Manage.addCourt')}
              </button>
              <button onClick={() => setBoard(true)} className="py-3 rounded-2xl bg-white shadow-sm text-sm font-bold text-gray-600 active:scale-[0.98]">
                📋 {t('Manage.seatingBoard')}
              </button>
            </div>
          </>
        )}

        {/* ===== 點名・收錢 ===== */}
        {tab === 'roster' && (
          <>
            <SignupReviewPanel
              view={session}
              players={players ?? []}
              busy={approveFamily.isPending || removePlayer.isPending}
              onApprove={async (p, overQuota) => {
                if (overQuota && !(await confirm({ message: t('SessionManagePage.confirmApproveOverQuota', { name: p.display_name }), confirmText: t('SessionManagePage.approve') }))) return
                approveFamily.mutate(p.player_id)
              }}
              onReject={async (p) => {
                if (await confirm({ message: t('SessionManagePage.confirmReject', { name: p.display_name }), confirmText: t('SessionManagePage.reject'), danger: true }))
                  removePlayer.mutate(p.player_id)
              }}
            />
            <RosterTab
              roster={roster}
              dup={dup}
              onOpen={(p) => setPlayerSheet(p.player_id)}
              onPaid={(p, paid) => setPaid.mutate({ playerId: p.player_id, paid })}
              onAddOne={(n) => addPlayer.mutate(n)}
              busyId={(setPaid.isPending && setPaid.variables?.playerId) || undefined}
            />
          </>
        )}

        {/* ===== 邀請 ===== */}
        {tab === 'invite' && (
          <div className="bg-white rounded-[1.75rem] shadow-md p-5 flex flex-col items-center text-center space-y-4">
            <p className="font-extrabold text-gray-800 text-lg">{t('Manage.inviteTitle')}</p>
            <div className="p-3 rounded-3xl bg-white shadow-inner border border-gray-100">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <p className="text-xs text-gray-400">{t('Manage.inviteHint')}</p>
            <button
              onClick={async () => {
                const r = await shareContent({
                  title: session?.title || t('SessionManagePage.defaultGroupName'),
                  text: t('SessionManagePage.shareText', { title: session?.title || t('SessionManagePage.defaultGroupName') }),
                  url: joinUrl,
                })
                if (r === 'copied') alert(t('SessionManagePage.copiedInvite'))
              }}
              className="w-full py-3.5 rounded-2xl bg-[#06C755] text-white font-extrabold"
            >
              {t('SessionManagePage.shareToLine')}
            </button>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button onClick={() => navigator.clipboard.writeText(joinUrl)} className="py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-bold">
                🔗 {t('Manage.copyLink')}
              </button>
              <button onClick={() => setPoster(true)} className="py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-bold">
                🖥️ {t('Manage.poster')}
              </button>
            </div>
          </div>
        )}

        {/* ===== 更多 ===== */}
        {tab === 'more' && (
          <>
            <AnnouncementCard sessionId={sid} announcement={session?.announcement} />
            <div className="bg-white rounded-3xl shadow-sm p-1.5">
              <SheetAction icon="🛠️" label={t('Manage.sessionSettings')} hint={t('Manage.sessionSettingsHint')} onClick={() => setSettingsOpen(true)} />
              <SheetAction icon="📊" label={t('SessionManagePage.summary')} hint={t('Manage.summaryHint')} onClick={() => setSummary(true)} />
              <LanguageRow />
            </div>
            <StatsPanel sessionId={sid} players={roster} />
            <ActionLogPanel sessionId={sid} />
            <button onClick={closeSession} className="w-full py-3.5 rounded-2xl border-2 border-red-200 text-red-500 font-extrabold bg-white">
              {t('SessionManagePage.endSession')}
            </button>
          </>
        )}
      </main>

      {/* 底部分頁列(拇指區) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-pink-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-xl mx-auto grid grid-cols-4">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={`relative py-2 flex flex-col items-center gap-0.5 text-[11px] font-bold ${tab === n.key ? 'text-gray-900' : 'text-gray-400'}`}
            >
              <span className={`text-xl leading-none transition-transform ${tab === n.key ? 'scale-110' : 'grayscale opacity-60'}`}>{n.icon}</span>
              {n.label}
              {tab === n.key && <span className="absolute top-0 w-8 h-1 rounded-b-full bg-brand-pink" />}
              {n.badge ? (
                <span className="absolute top-1 right-[calc(50%-1.6rem)] min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-orange-500 text-white text-[10px] leading-[1.1rem]">
                  {n.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {/* ===== 抽屜 / 全螢幕 ===== */}
      <PlayerSheet
        key={playerSheet ?? 'none'}
        player={sheetPlayer}
        onCourt={sheetWhere ? { courtTitle: courtTitle(sheetWhere.court), playing: sheetWhere.playing } : undefined}
        ownerName={sheetPlayer?.owner_id ? byId.get(sheetPlayer.owner_id)?.display_name : undefined}
        onClose={() => setPlayerSheet(null)}
        onPaid={(paid) => sheetPlayer && setPaid.mutate({ playerId: sheetPlayer.player_id, paid })}
        onLevel={(level) => sheetPlayer && setLevel.mutate({ playerId: sheetPlayer.player_id, level })}
        onRename={(name) => sheetPlayer && setPlayerName.mutate({ playerId: sheetPlayer.player_id, name })}
        onApprove={() => sheetPlayer && approveFamily.mutate(sheetPlayer.player_id)}
        onOffCourt={() => {
          if (sheetPlayer && sheetWhere) kick.mutate({ courtId: sheetWhere.court.court_id, playerId: sheetPlayer.player_id })
          setPlayerSheet(null)
        }}
        onRemove={async () => {
          if (!sheetPlayer) return
          if (await confirm({ message: t('SessionManagePage.confirmDisconnect', { name: sheetPlayer.display_name }), confirmText: t('SessionManagePage.disconnect'), danger: true })) {
            removePlayer.mutate(sheetPlayer.player_id)
            setPlayerSheet(null)
          }
        }}
      />
      <AddToCourtSheet
        key={addTarget ? addTarget.courtId + addTarget.mode : 'none'}
        target={addCourtObj && addTarget ? { court: addCourtObj, mode: addTarget.mode } : null}
        courtTitle={addCourtObj ? courtTitle(addCourtObj) : ''}
        candidates={free}
        onClose={() => setAddTarget(null)}
        onPick={(p) => {
          if (!addTarget) return
          if (addTarget.mode === 'playing') addPlaying.mutate({ courtId: addTarget.courtId, playerId: p.player_id })
          else addQueue.mutate({ courtId: addTarget.courtId, playerId: p.player_id })
          // 場上 / 排隊滿了就收起來,沒滿可以繼續點下一位
          const c = addCourtObj
          const filledAfter = addTarget.mode === 'playing' ? (c?.playing.filter((s) => s.player_id).length ?? 0) + 1 : (c?.queue.length ?? 0) + 1
          if (filledAfter >= 4) setAddTarget(null)
        }}
      />
      <CourtMenuSheet
        key={menuCourt ?? 'none'}
        court={menuCourtObj}
        title={menuCourtObj ? courtTitle(menuCourtObj) : ''}
        canSwap={courts.length > 1 && courts.some((c) => c.queue.length > 0)}
        onClose={() => setMenuCourt(null)}
        onRename={(name) => menuCourtObj && renameCourt.mutate({ courtId: menuCourtObj.court_id, name })}
        onToggleLock={() => menuCourtObj && lockCourt.mutate({ courtId: menuCourtObj.court_id, locked: !menuCourtObj.locked })}
        onSwap={() => menuCourtObj && setSwapSource(menuCourtObj.court_id)}
        onRemove={async () => {
          if (!menuCourtObj) return
          const hasPlaying = menuCourtObj.playing.some((p) => p.player_id)
          if (await confirm({ message: hasPlaying ? t('SessionManagePage.confirmRemoveCourtPlaying') : t('SessionManagePage.confirmRemoveCourt'), confirmText: t('SessionManagePage.delete'), danger: true })) {
            removeCourt.mutate(menuCourtObj.court_id)
            setMenuCourt(null)
          }
        }}
      />
      <Sheet open={editTitle} onClose={() => setEditTitle(false)} title={t('Manage.renameSession')}>
        <input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
          maxLength={20}
          autoFocus
          className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-3 py-3 text-base focus:outline-none focus:border-brand-pink focus:bg-white"
        />
        {titleErr && <p className="text-red-400 text-sm mt-1">{titleErr}</p>}
        <button onClick={saveTitle} disabled={!titleInput.trim()} className="mt-3 w-full py-3.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:bg-gray-200">
          {t('Manage.save')}
        </button>
      </Sheet>
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('Manage.sessionSettings')}>
        <div className="space-y-3 -mx-1">
          <LocationCard sessionId={sid} city={session?.city} district={session?.district} />
          <ContactCard sessionId={sid} contactUrl={session?.contact_url} description={session?.description} />
          <SignupSettingsCard sessionId={sid} view={session} />
          <FairPlayCard sessionId={sid} view={session} />
          <PasswordCard sessionId={sid} />
          <TimesCard sessionId={sid} startAt={session?.start_at} endAt={session?.end_at} queueOpenAt={session?.queue_open_at} />
        </div>
      </Sheet>

      {board && <SeatingBoard sessionId={sid} onClose={() => setBoard(false)} />}
      {swapSource && session && (
        <SwapQueueModal
          courts={session.courts}
          sourceCourtId={swapSource}
          pending={swapQueue.isPending}
          onClose={() => setSwapSource(null)}
          onConfirm={(pick) => swapQueue.mutate(pick, { onSuccess: () => setSwapSource(null) })}
        />
      )}
      {poster && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center p-6 text-center" onClick={() => setPoster(false)}>
          <div className="text-5xl mb-4">🏸</div>
          <p className="text-2xl font-extrabold text-gray-800">{session?.title?.trim() ? session.title : t('SessionManagePage.posterTitle')}</p>
          <p className="text-gray-400 mb-6">{t('SessionManagePage.posterSubtitle')}</p>
          <div className="bg-white p-4 rounded-3xl shadow-xl border">
            <QRCodeSVG value={joinUrl} size={Math.min(360, window.innerWidth - 80)} />
          </div>
          <p className="text-gray-300 text-sm mt-8">{t('SessionManagePage.posterClose')}</p>
        </div>
      )}
    </div>
  )
}
