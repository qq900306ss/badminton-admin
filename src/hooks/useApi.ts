import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionApi, seatApi } from '../api/client'

export function useSessionView(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.getView(sessionId).then((r) => r.data.data),
    // real-time updates come via WebSocket (see SessionManagePage); this slow
    // interval is just a safety net for when the socket drops.
    refetchInterval: 30000,
    enabled: !!sessionId,
  })
}

export function useSessionPlayers(sessionId: string) {
  return useQuery({
    queryKey: ['session-players', sessionId],
    queryFn: () => sessionApi.getPlayers(sessionId).then((r) => r.data.data),
    refetchInterval: 30000, // WS-driven; slow fallback only
    enabled: !!sessionId,
  })
}

export function useSessionPassword(sessionId: string) {
  return useQuery({
    queryKey: ['session-password', sessionId],
    queryFn: () => sessionApi.getPassword(sessionId).then((r) => r.data.data.password),
    enabled: !!sessionId,
  })
}

export function useSetPassword(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (password: string) =>
      sessionApi.setPassword(sessionId, password).then((r) => r.data.data.password),
    onSuccess: (pw) => qc.setQueryData(['session-password', sessionId], pw),
  })
}

// on-site seating board — leader acts on behalf of a player (same rules as front-end)
export function useSeatActions(sessionId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['session', sessionId] })
    qc.invalidateQueries({ queryKey: ['session-players', sessionId] })
  }
  const seatPlaying = useMutation({
    mutationFn: (v: { courtId: string; playerId: string; position: number }) =>
      seatApi.joinPlaying(sessionId, v.courtId, v.playerId, v.position),
    onSuccess: refresh,
  })
  const seatQueue = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      seatApi.joinQueue(sessionId, v.courtId, v.playerId),
    onSuccess: refresh,
  })
  const unseatPlaying = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      seatApi.leavePlaying(sessionId, v.courtId, v.playerId),
    onSuccess: refresh,
  })
  const unseatQueue = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      seatApi.leaveQueue(sessionId, v.courtId, v.playerId),
    onSuccess: refresh,
  })
  return { seatPlaying, seatQueue, unseatPlaying, unseatQueue }
}

export function useManageActions(sessionId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['session', sessionId] })
  const invalidatePlayers = () =>
    qc.invalidateQueries({ queryKey: ['session-players', sessionId] })

  const addPlayer = useMutation({
    mutationFn: (name: string) => sessionApi.addPlayer(sessionId, name),
    onSuccess: invalidatePlayers,
  })
  const setLevel = useMutation({
    mutationFn: (v: { playerId: string; level: number }) =>
      sessionApi.setLevel(sessionId, v.playerId, v.level),
    onSuccess: () => {
      invalidatePlayers()
      invalidate()
    },
  })
  const setPlayerName = useMutation({
    mutationFn: (v: { playerId: string; name: string }) =>
      sessionApi.setPlayerName(sessionId, v.playerId, v.name),
    onSuccess: () => {
      invalidatePlayers()
      invalidate()
    },
  })
  const setPaid = useMutation({
    mutationFn: (v: { playerId: string; paid: boolean }) =>
      sessionApi.setPaid(sessionId, v.playerId, v.paid),
    onSuccess: invalidatePlayers,
  })
  const approveFamily = useMutation({
    mutationFn: (playerId: string) => sessionApi.approveFamily(sessionId, playerId),
    onSuccess: () => {
      invalidatePlayers()
      invalidate()
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(m ?? '核准失敗,請稍後再試')
    },
  })
  const removePlayer = useMutation({
    mutationFn: (playerId: string) => sessionApi.removePlayer(sessionId, playerId),
    onSuccess: () => {
      invalidatePlayers()
      invalidate()
    },
  })

  const endCourt = useMutation({
    mutationFn: (courtId: string) => sessionApi.endCourt(sessionId, courtId),
    // ending a game changes player stats too → refresh players, not just courts
    onSuccess: () => {
      invalidate()
      invalidatePlayers()
    },
  })
  const undoEnd = useMutation({
    mutationFn: (courtId: string) => sessionApi.undoEnd(sessionId, courtId),
    onSuccess: () => {
      invalidate()
      invalidatePlayers() // undo rolls back stats too
    },
  })
  const kick = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      sessionApi.kick(sessionId, v.courtId, v.playerId),
    onSuccess: invalidate,
  })
  const addPlaying = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      sessionApi.addPlaying(sessionId, v.courtId, v.playerId),
    onSuccess: invalidate,
  })
  const addCourt = useMutation({
    mutationFn: () => sessionApi.addCourt(sessionId),
    onSuccess: invalidate,
  })
  const renameCourt = useMutation({
    mutationFn: (v: { courtId: string; name: string }) =>
      sessionApi.renameCourt(sessionId, v.courtId, v.name),
    onSuccess: invalidate,
  })
  const removeCourt = useMutation({
    mutationFn: (courtId: string) => sessionApi.removeCourt(sessionId, courtId),
    onSuccess: invalidate,
  })
  const addQueue = useMutation({
    mutationFn: (v: { courtId: string; playerId: string }) =>
      sessionApi.addQueue(sessionId, v.courtId, v.playerId),
    onSuccess: invalidate,
  })
  return { endCourt, undoEnd, kick, addPlaying, addCourt, addPlayer, setLevel, setPlayerName, setPaid, approveFamily, renameCourt, removeCourt, addQueue, removePlayer }
}
