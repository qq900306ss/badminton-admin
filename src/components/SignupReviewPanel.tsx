import type { SessionPlayer, SessionView } from '../api/client'
import { isPhotoUrl } from '../lib/avatar'
import { tierOf } from '../lib/levels'

// 🙋 臨打報名審核 — 獨立區塊,刻意跟成員列表裡的「家人核准」分開,讓新報名
// 一眼可見。只在有 pending 報名時出現。核准=變一般成員;婉拒=靜默移除
// (對方看不到通知,可再報)。名額只是軟上限:已滿時核准前提醒一句。
function Avatar({ p }: { p: SessionPlayer }) {
  const tier = tierOf(p.level)
  const bg = tier ? tier.avatarBg : 'bg-gray-300'
  if (isPhotoUrl(p.avatar_url))
    return <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
  return (
    <span className={`w-9 h-9 rounded-full ${bg} shrink-0 flex items-center justify-center text-base text-white`}>
      {p.avatar_url ? p.avatar_url : [...(p.display_name ?? '')][0]?.toUpperCase()}
    </span>
  )
}

interface Props {
  view?: SessionView
  players: SessionPlayer[]
  busy: boolean
  onApprove: (p: SessionPlayer, overQuota: boolean) => void
  onReject: (p: SessionPlayer) => void
}

export function SignupReviewPanel({ view, players, busy, onApprove, onReject }: Props) {
  const pending = players.filter((p) => p.pending && p.is_signup)
  // 家人跟著帶他來的本人排在一起(本人在前),孤兒家人(理論上不會有)墊後
  const mains = pending.filter((p) => !p.owner_id)
  const companions = pending.filter((p) => p.owner_id)
  const signups = [
    ...mains.flatMap((m) => [m, ...companions.filter((f) => f.owner_id === m.player_id)]),
    ...companions.filter((f) => !mains.some((m) => m.player_id === f.owner_id)),
  ]
  const ownerName = (id?: string) =>
    players.find((x) => x.player_id === id)?.display_name ?? '同行者'
  if (signups.length === 0) return null

  const quota = view?.signup_quota ?? 0
  const joined = view?.joined_count ?? players.filter((p) => !p.pending).length
  const overQuota = quota > 0 && joined >= quota

  return (
    <div className="card space-y-3 border-2 border-brand-pink/40">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">🙋 臨打報名審核 ({signups.length})</span>
        <span className={`text-xs font-bold ${overQuota ? 'text-red-500' : 'text-gray-400'}`}>
          已加入 {joined}{quota > 0 ? `/${quota}` : ''} 人
        </span>
      </div>
      <div className="space-y-2">
        {signups.map((p) => (
          <div key={p.player_id} className="rounded-2xl bg-gray-50 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <Avatar p={p} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-700 truncate">
                  {p.display_name}
                  {p.owner_id && (
                    <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-100 rounded-full px-1.5 py-0.5">
                      👨‍👩‍👧 {ownerName(p.owner_id)} 帶的
                    </span>
                  )}
                </p>
                {p.level > 0 && <p className="text-[11px] text-gray-400">程度 {p.level} 級</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => onApprove(p, overQuota)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-mint text-emerald-700 disabled:opacity-40"
                >
                  ✅ 核准
                </button>
                <button
                  onClick={() => onReject(p)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-200 text-gray-500 disabled:opacity-40"
                >
                  婉拒
                </button>
              </div>
            </div>
            {p.signup_msg && (
              <p className="text-sm text-gray-600 bg-white rounded-xl px-3 py-2 whitespace-pre-wrap">
                💬 {p.signup_msg}
              </p>
            )}
          </div>
        ))}
      </div>
      {overQuota && (
        <p className="text-[11px] text-red-400">名額已滿——還是可以核准,收不收由你決定。</p>
      )}
    </div>
  )
}
