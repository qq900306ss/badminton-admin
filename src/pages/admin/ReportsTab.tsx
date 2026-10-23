import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminPlayer, type Org, type Report, type ReportReason } from '../../api/client'
import { useConfirm } from '../../components/Confirm'
import { ClientBadge } from '../../components/ClientBadge'
import { ActionBtn, BanToggle, Swatch } from './ui'
import { errMsg, fmtWhen } from './format'

// 檢舉:看內容快照 → 清除名稱頭像 / 停權 / 停用團主 → 標記已處理。被檢舉的球友可直接開成員詳情

const REASON_KEY: Record<ReportReason, string> = {
  inappropriate: 'AdminPage.reasonInappropriate',
  harassment: 'AdminPage.reasonHarassment',
  spam: 'AdminPage.reasonSpam',
  other: 'AdminPage.reasonOther',
  blocked: 'AdminPage.reasonBlocked',
}

export function ReportsTab({
  orgs,
  players,
  openReports,
  openReportsErr,
  onOpenMember,
}: {
  orgs: Org[] | undefined
  players: AdminPlayer[] | undefined
  openReports: Report[] | undefined
  openReportsErr: boolean
  onOpenMember: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [reportFilter, setReportFilter] = useState<'open' | 'all'>('open')
  const [notes, setNotes] = useState<Record<string, string>>({}) // 檢舉 id → 處理備註草稿

  const { data: allReports, isError: allReportsErr } = useQuery({
    queryKey: ['admin-reports', 'all'],
    queryFn: () => adminApi.listReports('all').then((r) => r.data.data ?? []),
    enabled: reportFilter === 'all',
  })
  const reports = reportFilter === 'all' ? allReports : openReports
  const reportsErr = reportFilter === 'all' ? allReportsErr : openReportsErr
  const openReportCount = openReports?.length ?? 0
  const playerById = new Map((players ?? []).map((p) => [p.player_id, p]))
  const orgNameOf = (id: string) => (orgs ?? []).find((o) => o.org_id === id)?.org_name ?? t('AdminPage.unknown')

  const alertErr = (e: unknown) => alert(errMsg(e) ?? t('AdminPage.actionFailed'))
  const toggleDisabled = useMutation({
    mutationFn: (v: { orgId: string; disabled: boolean }) => adminApi.setDisabled(v.orgId, v.disabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs'] }),
    onError: alertErr,
  })
  const setBanned = useMutation({
    mutationFn: (v: { playerId: string; banned: boolean }) => adminApi.setPlayerBanned(v.playerId, v.banned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-players'] }),
    onError: alertErr,
  })
  const resetProfile = useMutation({
    mutationFn: (playerId: string) => adminApi.resetPlayerProfile(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-players'] }),
    onError: alertErr,
  })
  const resolveReport = useMutation({
    mutationFn: (v: { id: string; note: string }) => adminApi.resolveReport(v.id, v.note),
    onSuccess: (_r, v) => {
      setNotes((n) => {
        const next = { ...n }
        delete next[v.id]
        return next
      })
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: alertErr,
  })

  async function banPlayer(p: { player_id: string; name: string }) {
    if (await confirm({ message: t('AdminPage.banConfirm', { name: p.name }), confirmText: t('AdminPage.ban'), danger: true })) {
      setBanned.mutate({ playerId: p.player_id, banned: true })
    }
  }
  async function disableHost(orgId: string) {
    if (await confirm({ message: t('AdminPage.disableHostConfirm', { name: orgNameOf(orgId) }), confirmText: t('AdminPage.disableHost'), danger: true })) {
      toggleDisabled.mutate({ orgId, disabled: true })
    }
  }

  return (
      <div className="card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-700">{t('AdminPage.reportsTitle')}</span>
          <div className="flex gap-1">
            {(['open', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setReportFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  reportFilter === f ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {f === 'open' ? t('AdminPage.reportsOpen', { count: openReportCount }) : t('AdminPage.reportsAll')}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400">{t('AdminPage.reportsHint')}</p>
        {reportsErr && <p className="text-sm text-red-400">{t('AdminPage.reportsLoadFailed')}</p>}
        {!reports && !reportsErr && <p className="text-sm text-gray-300">{t('AdminPage.loading')}</p>}
        {reports && reports.length === 0 && (
          <p className="text-sm text-gray-300">
            {reportFilter === 'open' ? t('AdminPage.noOpenReports') : t('AdminPage.noReports')}
          </p>
        )}
        {(reports ?? []).map((r: Report) => {
          const acctId = r.target_account_id
          const acct = acctId ? playerById.get(acctId) : undefined
          const org = (orgs ?? []).find((o) => o.org_id === r.target_org_id)
          // 處理對象:有帳號的球友 → 清除/停權;團主手動加的名字或開團內容 → 停用團主
          const hostIsTarget = r.target_type === 'session' || !acctId
          return (
            <div key={r.id} className="py-3 border-b last:border-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.reason === 'blocked' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-500'
                  }`}
                >
                  {t(REASON_KEY[r.reason] ?? 'AdminPage.reasonOther')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-lavender/60 text-violet-600">
                  {r.target_type === 'player' ? t('AdminPage.targetPlayer') : t('AdminPage.targetSession')}
                </span>
                {r.status === 'resolved' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-mint text-emerald-700">
                    {t('AdminPage.resolvedBadge')}
                  </span>
                )}
                <ClientBadge client={r.client} hideUnknown />
                <span className="text-[11px] text-gray-300 ml-auto">{fmtWhen(r.created_at)}</span>
              </div>
              <p className="text-xs text-gray-400">
                {t('AdminPage.reporter', { name: r.reporter_name || t('AdminPage.anonymous') })}
              </p>
              {r.detail && <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.detail}</p>}

              {/* 內容快照(檢舉當下的原文,之後被改掉也看得到) */}
              <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400">{t('AdminPage.snapshotTitle')}</p>
                {r.target_type === 'player' ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Swatch url={r.target_avatar_url} fallback={(r.target_name || '?')[0]} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 break-all">
                        {r.target_name || t('AdminPage.noName')}
                        {acct?.banned && (
                          <span className="ml-2 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.bannedBadge')}</span>
                        )}
                      </p>
                      {!acctId && <p className="text-[11px] text-amber-600">{t('AdminPage.hostCreatedName')}</p>}
                      {acctId && players && !acct && <p className="text-[11px] text-gray-400">{t('AdminPage.accountGone')}</p>}
                    </div>
                  </div>
                ) : (
                  ([
                    ['snapTitle', r.session_title],
                    ['snapDescription', r.session_description],
                    ['snapAnnouncement', r.session_announcement],
                  ] as const).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[11px] text-gray-400">{t(`AdminPage.${k}`)}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{v || t('AdminPage.snapEmpty')}</p>
                    </div>
                  ))
                )}
                <button onClick={() => nav(`/session/${r.session_id}`)} className="text-[11px] text-left text-gray-400">
                  {t('AdminPage.inSession', { title: r.session_title || t('AdminPage.untitled'), org: orgNameOf(r.target_org_id) })}
                  <span className="text-brand-pink font-semibold"> {t('AdminPage.view')}</span>
                </button>
              </div>

              {/* 處理動作 */}
              <div className="flex flex-wrap items-center gap-2">
                {!hostIsTarget && acct && (
                  <>
                    <ActionBtn onClick={() => onOpenMember(acct.player_id)} tone="pink">
                      {t('AdminConsole.viewMember')}
                    </ActionBtn>
                    <button
                      onClick={async () => {
                        const name = r.target_name || acct.join_name || acct.display_name
                        if (await confirm({ message: t('AdminPage.resetProfileConfirm', { name }), confirmText: t('AdminPage.resetProfile'), danger: true })) {
                          resetProfile.mutate(acct.player_id)
                        }
                      }}
                      disabled={resetProfile.isPending && resetProfile.variables === acct.player_id}
                      className="text-xs font-bold px-3 py-1.5 rounded-2xl border-2 border-amber-200 text-amber-600 disabled:opacity-50"
                    >
                      {resetProfile.isSuccess && resetProfile.variables === acct.player_id ? t('AdminPage.resetDone') : t('AdminPage.resetProfile')}
                    </button>
                    <BanToggle
                      boxed
                      banned={!!acct.banned}
                      pending={setBanned.isPending && setBanned.variables?.playerId === acct.player_id}
                      onBan={() => banPlayer({ player_id: acct.player_id, name: r.target_name || acct.join_name || acct.display_name })}
                      onUnban={() => setBanned.mutate({ playerId: acct.player_id, banned: false })}
                    />
                  </>
                )}
                {hostIsTarget && org && org.role !== 'superadmin' && (
                  <button
                    onClick={() =>
                      org.disabled ? toggleDisabled.mutate({ orgId: org.org_id, disabled: false }) : disableHost(org.org_id)
                    }
                    disabled={toggleDisabled.isPending}
                    className={`text-xs font-bold px-3 py-1.5 rounded-2xl border-2 disabled:opacity-50 ${
                      org.disabled ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-500'
                    }`}
                  >
                    {org.disabled ? t('AdminPage.enableHost') : t('AdminPage.disableHost')}
                  </button>
                )}
                {hostIsTarget && org?.disabled && (
                  <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">{t('AdminPage.disabledBadge')}</span>
                )}
              </div>

              {r.status === 'open' ? (
                <div className="flex gap-2">
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder={t('AdminPage.resolveNotePlaceholder')}
                    maxLength={200}
                    className="flex-1 min-w-0 border-2 border-gray-200 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                  />
                  <button
                    onClick={() => resolveReport.mutate({ id: r.id, note: (notes[r.id] ?? '').trim() })}
                    disabled={resolveReport.isPending && resolveReport.variables?.id === r.id}
                    className="btn-primary px-4 py-1.5 text-xs shrink-0 disabled:opacity-50"
                  >
                    {t('AdminPage.markResolved')}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-emerald-600">
                  {t('AdminPage.resolvedAt', { at: r.resolved_at ? fmtWhen(r.resolved_at) : '' })}
                  {r.resolved_note && <span className="text-gray-500"> · {r.resolved_note}</span>}
                </p>
              )}
            </div>
          )
        })}
      </div>
  )
}
