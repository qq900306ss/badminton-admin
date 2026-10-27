import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminPlayer, type Org, type PlayerStats } from '../../api/client'
import { useConfirm } from '../../components/Confirm'
import { ClientBadge } from '../../components/ClientBadge'
import { parseClient, platformName } from '../../lib/clientSource'
import { ActionBtn, BanToggle, Stat, Swatch } from './ui'
import { PROVIDER_LABEL, ago, errMsg, fmtDate, fmtMinutes, fmtWhen, lastActiveOf } from './format'

// 成員詳情(右側抽屜 / 手機全螢幕):身分、統計、打過哪些團、常一起打的人、最近比賽、處理動作

type Section = 'sessions' | 'partners' | 'games'

export function MemberDetail({
  player,
  stats,
  orgs,
  now,
  onClose,
  onOpenMember,
}: {
  player: AdminPlayer
  stats?: PlayerStats
  orgs: Org[] | undefined
  now: number
  onClose: () => void
  onOpenMember: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [section, setSection] = useState<Section>('sessions')
  const p = player
  const name = p.join_name || p.display_name || t('AdminPage.noName')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: act, isError, isLoading } = useQuery({
    queryKey: ['admin-player-activity', p.player_id],
    // 後端沒資料的陣列回 null(沒打過比賽 → partners/games 是 null、只有自己的場 → with 是 null),這裡統一補成 []
    queryFn: () =>
      adminApi.playerActivity(p.player_id).then((r) => {
        const d = r.data.data
        return {
          ...d,
          sessions: d.sessions ?? [],
          partners: d.partners ?? [],
          games: (d.games ?? []).map((g) => ({ ...g, with: g.with ?? [] })),
        }
      }),
    staleTime: 30_000,
  })
  const orgName = (id: string) => (orgs ?? []).find((o) => o.org_id === id)?.org_name ?? t('AdminPage.unknown')
  const titleOf = (sid: string) => act?.sessions.find((s) => s.session_id === sid)?.title || t('AdminPage.untitled')

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-players'] })
  const setBanned = useMutation({
    mutationFn: (banned: boolean) => adminApi.setPlayerBanned(p.player_id, banned),
    onSuccess: refresh,
    onError: (e) => alert(errMsg(e) ?? t('AdminPage.actionFailed')),
  })
  const resetProfile = useMutation({
    mutationFn: () => adminApi.resetPlayerProfile(p.player_id),
    onSuccess: refresh,
    onError: (e) => alert(errMsg(e) ?? t('AdminPage.actionFailed')),
  })

  const signup = parseClient(p.signup_client)
  const lastPf = parseClient(p.last_client)
  const hosts = new Set((act?.sessions ?? []).filter((s) => !s.pending).map((s) => s.org_id)).size

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg h-full bg-brand-bg overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <span className="font-extrabold text-gray-800 truncate">{name}</span>
          <button onClick={onClose} className="text-gray-400 text-lg px-2" aria-label="close">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* 身分:登入時 → 現在使用 */}
          <div className="card space-y-3">
            <div className="flex items-center gap-3">
              <Swatch url={p.avatar_url || p.photo_url} fallback={name[0]} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="truncate">{name}</span>
                  {p.banned && <span className="shrink-0 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">{t('AdminPage.bannedBadge')}</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {PROVIDER_LABEL[p.provider] ?? p.provider}
                  {p.email && ` · ${p.email}`}
                </p>
                <p className="text-xs text-gray-400">
                  {t('AdminConsole.loginName', { name: p.display_name || '—' })}
                  {' · '}
                  {p.default_level === -1 ? t('AdminConsole.levelPrivate') : p.default_level ? t('AdminPage.defaultLevel', { level: p.default_level }) : t('AdminPage.noLevelSet')}
                </p>
              </div>
              {p.photo_url && p.photo_url !== p.avatar_url && <Swatch url={p.photo_url} fallback="?" size="sm" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
              <ClientBadge client={p.last_client} />
              {p.signup_client && signup.platform !== lastPf.platform && (
                <span>{t('ClientSource.signupFrom', { platform: platformName(signup.platform, t) })}</span>
              )}
              <span>· {t('AdminConsole.signedUp', { date: fmtDate(p.created_at) })}</span>
              {p.last_seen_at && <span>· {t('AdminConsole.appSeen', { when: ago(p.last_seen_at, now, t) })}</span>}
            </div>
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('AdminConsole.statLastActive')} value={ago(lastActiveOf(p, stats, now), now, t)} />
            <Stat
              label={t('AdminConsole.statLastPlayed')}
              value={stats?.last_session_at ? ago(stats.last_session_at, now, t) : '—'}
            />
            <Stat
              label={t('AdminConsole.statJoinedSessions')}
              value={stats?.sessions ?? 0}
              hint={t('AdminConsole.playedInHosts', { played: stats?.played_in ?? 0, hosts })}
            />
            <Stat
              label={t('AdminConsole.statGames')}
              value={stats?.games ?? 0}
              hint={stats?.minutes ? fmtMinutes(stats.minutes, t) : undefined}
            />
          </div>

          {/* 打過哪些團 / 跟誰打 / 最近比賽 */}
          <div className="card space-y-3">
            <div className="flex gap-1.5">
              {(['sessions', 'partners', 'games'] as Section[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSection(k)}
                  className={`flex-1 text-xs font-bold py-1.5 rounded-full ${
                    section === k ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t(`AdminConsole.section_${k}`)}
                  {act && <span className="opacity-80"> {k === 'sessions' ? act.sessions.length : k === 'partners' ? act.partners.length : act.games.length}</span>}
                </button>
              ))}
            </div>

            {isLoading && <p className="text-sm text-gray-300">{t('AdminPage.loading')}</p>}
            {isError && <p className="text-sm text-red-400">{t('AdminConsole.activityFailed')}</p>}

            {act && section === 'sessions' && (
              <div>
                {act.sessions.length === 0 && <p className="text-sm text-gray-300">{t('AdminConsole.noSessions')}</p>}
                {act.sessions.map((s) => (
                  <button
                    key={s.session_id}
                    disabled={s.missing}
                    onClick={() => nav(`/session/${s.session_id}`)}
                    className="w-full text-left py-2 border-b border-gray-100 last:border-0 flex items-center gap-2 disabled:cursor-default"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-700 truncate">
                        {s.missing ? t('AdminConsole.deletedSession') : s.title || t('AdminPage.untitled')}
                        {s.pending && <span className="ml-1.5 text-[10px] bg-brand-yellow text-amber-700 px-1.5 py-0.5 rounded-full">{t('AdminConsole.pendingBadge')}</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {!s.missing && `${orgName(s.org_id)} · `}
                        {fmtWhen(s.at)}
                        {s.name !== name && ` · ${t('AdminConsole.asName', { name: s.name })}`}
                        {s.level ? ` · Lv${s.level}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${s.games ? 'text-gray-700' : 'text-gray-300'}`}>{t('AdminConsole.gamesN', { n: s.games })}</p>
                      <p className="text-[10px] text-gray-400">
                        {[s.minutes ? fmtMinutes(s.minutes, t) : '', s.paid ? t('AdminConsole.paid') : ''].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {act && section === 'partners' && (
              <div>
                {act.partners.length === 0 && <p className="text-sm text-gray-300">{t('AdminConsole.noPartners')}</p>}
                {act.partners.map((pt) => (
                  <button
                    key={(pt.account_id ?? '') + pt.name}
                    disabled={!pt.account_id}
                    onClick={() => pt.account_id && onOpenMember(pt.account_id)}
                    className="w-full text-left py-2 border-b border-gray-100 last:border-0 flex items-center gap-2 disabled:cursor-default"
                  >
                    <span className="text-sm font-semibold text-gray-700 truncate flex-1">
                      {pt.name}
                      {!pt.account_id && <span className="ml-1.5 text-[10px] font-normal text-gray-400">{t('AdminConsole.noAccount')}</span>}
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0">{ago(pt.last_at, now, t)}</span>
                    <span className="text-xs font-bold text-gray-700 shrink-0 w-14 text-right">{t('AdminConsole.gamesN', { n: pt.games })}</span>
                    {pt.account_id && <span className="text-brand-pink text-sm">›</span>}
                  </button>
                ))}
              </div>
            )}

            {act && section === 'games' && (
              <div>
                {act.games.length === 0 && <p className="text-sm text-gray-300">{t('AdminConsole.noGames')}</p>}
                {act.games.map((g, i) => (
                  <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                    <p className="text-[11px] text-gray-400">
                      {fmtWhen(g.ended_at)} · {titleOf(g.session_id)} · {t('AdminConsole.courtN', { n: g.court_num })} ·{' '}
                      {fmtMinutes(g.minutes, t)}
                    </p>
                    <p className="text-sm text-gray-700">{t('AdminConsole.withPeople', { names: g.with.join('、') })}</p>
                  </div>
                ))}
              </div>
            )}

            {act && section !== 'sessions' && (
              <p className="text-[11px] text-gray-400">{t('AdminConsole.partnersHint', { n: act.games_from_count })}</p>
            )}
            {act && section === 'sessions' && <p className="text-[11px] text-gray-400">{t('AdminConsole.retentionHint')}</p>}
          </div>

          {/* 處理 */}
          <div className="card flex flex-wrap items-center gap-2">
            <ActionBtn
              tone="amber"
              disabled={resetProfile.isPending}
              onClick={async () => {
                if (await confirm({ message: t('AdminPage.resetProfileConfirm', { name }), confirmText: t('AdminPage.resetProfile'), danger: true }))
                  resetProfile.mutate()
              }}
            >
              {resetProfile.isSuccess ? t('AdminPage.resetDone') : t('AdminPage.resetProfile')}
            </ActionBtn>
            <BanToggle
              boxed
              banned={!!p.banned}
              pending={setBanned.isPending}
              onBan={async () => {
                if (await confirm({ message: t('AdminPage.banConfirm', { name }), confirmText: t('AdminPage.ban'), danger: true }))
                  setBanned.mutate(true)
              }}
              onUnban={() => setBanned.mutate(false)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
