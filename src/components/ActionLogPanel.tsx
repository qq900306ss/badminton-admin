import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionApi } from '../api/client'

// 團主操作紀錄:踢人 / 移人 / 改名 / 結束場地…(後端保留 90 天)
export function ActionLogPanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['action-logs', sessionId],
    queryFn: () => sessionApi.actionLogs(sessionId).then((r) => r.data.data),
    enabled: open, // only fetch when the panel is opened
  })

  return (
    <div className="card">
      <button
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) refetch() // re-pull on open so it's never a stale snapshot
        }}
        className="w-full flex items-center justify-between text-sm font-bold text-gray-600"
      >
        <span>📋 操作紀錄</span>
        <span className="text-gray-300">{open ? '收起 ▲' : '展開 ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">最近 200 筆,保留 90 天</span>
            <button
              onClick={() => refetch()}
              className="text-[11px] font-bold text-brand-pink"
            >
              {isFetching ? '更新中…' : '🔄 重新整理'}
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-300">載入中…</p>
          ) : (data ?? []).length === 0 ? (
            <p className="text-sm text-gray-300">還沒有任何操作紀錄</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {(data ?? []).map((log) => (
                <li
                  key={log.ts_id}
                  className="flex items-start gap-2 text-sm border-b border-gray-50 pb-1.5"
                >
                  <span className="text-gray-700 flex-1">{log.detail}</span>
                  <span className="text-[11px] text-gray-300 shrink-0 tabular-nums">
                    {fmtTime(log.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// 顯示成「6/28 14:03」相對好讀,失敗就原樣顯示
function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
