// Pulsing placeholder cards while data loads (no layout jump when it arrives)
export function CourtSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-36 bg-gray-100 rounded-2xl mb-3" />
          <div className="h-8 bg-gray-100 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
          <div className="h-8 w-16 bg-gray-100 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}
