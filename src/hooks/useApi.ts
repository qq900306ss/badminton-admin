import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgApi, sessionApi } from '../api/client'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => orgApi.getMembers().then((r) => r.data.data),
  })
}

export function useMemberActions() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['members'] })
  const add = useMutation({
    mutationFn: (name: string) => orgApi.addMember(name),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => orgApi.deleteMember(id),
    onSuccess: invalidate,
  })
  return { add, remove }
}

export function useSessionView(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.getView(sessionId).then((r) => r.data.data),
    refetchInterval: 3000,
    enabled: !!sessionId,
  })
}

export function useSessionPlayers(sessionId: string) {
  return useQuery({
    queryKey: ['session-players', sessionId],
    queryFn: () => sessionApi.getPlayers(sessionId).then((r) => r.data.data),
    refetchInterval: 3000,
    enabled: !!sessionId,
  })
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

  const endCourt = useMutation({
    mutationFn: (courtId: string) => sessionApi.endCourt(sessionId, courtId),
    onSuccess: invalidate,
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
  return { endCourt, kick, addPlaying, addCourt, addPlayer, setLevel, renameCourt, removeCourt }
}
