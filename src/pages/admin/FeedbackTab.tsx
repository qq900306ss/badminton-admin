import { useTranslation } from 'react-i18next'
import type { Feedback } from '../../api/client'
import { ClientBadge } from '../../components/ClientBadge'
import { fmtWhen } from './format'

export function FeedbackTab({ feedback }: { feedback: Feedback[] | undefined }) {
  const { t } = useTranslation()
  return (
      <div className="card space-y-2">
        <span className="font-bold text-gray-700">{t('AdminPage.feedbackTitle', { count: (feedback ?? []).length })}</span>
        {(feedback ?? []).length === 0 && <p className="text-sm text-gray-300">{t('AdminPage.noFeedback')}</p>}
        {(feedback ?? []).map((f) => (
          <div key={f.id} className="py-2 border-b last:border-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  f.role === 'leader' ? 'bg-brand-yellow text-amber-700' : 'bg-brand-mint text-emerald-700'
                }`}
              >
                {f.role === 'leader' ? t('AdminPage.roleHost') : t('AdminPage.rolePlayer')}
              </span>
              <span className="font-semibold text-gray-700 text-sm">{f.author_name || t('AdminPage.anonymous')}</span>
              {f.email && <span className="text-xs text-gray-400">{f.email}</span>}
              <ClientBadge client={f.client} hideUnknown />
              <span className="text-[11px] text-gray-300 ml-auto">{fmtWhen(f.created_at)}</span>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{f.message}</p>
          </div>
        ))}
      </div>
  )
}
