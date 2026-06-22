import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const api = axios.create({ baseURL: BASE })

// attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// on 401, clear token and bounce to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export interface Org {
  org_id: string
  google_email: string
  org_name: string
  role: 'superadmin' | 'leader'
  disabled?: boolean
}

export interface OrgMember {
  org_id: string
  member_id: string
  display_name: string
  is_active: boolean
}

export interface PlayerSlot {
  player_id: string
  display_name: string
  level: number
  games: number
}

export interface CourtView {
  court_id: string
  court_num: number
  name?: string
  status: 'empty' | 'playing'
  playing: PlayerSlot[]
  queue: PlayerSlot[]
  started_at?: string
}

export interface GameLog {
  session_id: string
  ended_at_id: string
  court_num: number
  player_names: string[]
  started_at: string
  ended_at: string
  minutes: number
}

export interface SessionView {
  session_id: string
  num_courts: number
  status: string
  courts: CourtView[]
}

export interface SessionPlayer {
  player_id: string
  display_name: string
  level: number
  claimed: boolean
  games: number
  total_minutes: number
  is_temp: boolean
}

export interface SessionSummary {
  session_id: string
  org_id: string
  title: string
  num_courts: number
  status: string
  start_at?: string
  end_at?: string
  queue_open_at?: string
  opened_at: string
}

export interface CreateSessionInput {
  title: string
  password: string
  num_courts: number
  player_names: string[]
  start_at?: string
  end_at?: string
  queue_open_at?: string
}

export const authApi = {
  google: (code: string) =>
    api.post<{ data: { token: string; org: Org } }>('/api/auth/google', { code }),
  me: () => api.get<{ data: Org }>('/api/auth/me'),
}

export const orgApi = {
  getMembers: () => api.get<{ data: OrgMember[] }>('/api/orgs/members'),
  addMember: (display_name: string) =>
    api.post<{ data: OrgMember }>('/api/orgs/members', { display_name }),
  deleteMember: (memberId: string) => api.delete(`/api/orgs/members/${memberId}`),
}

export const sessionApi = {
  create: (input: CreateSessionInput) =>
    api.post<{ data: { session_id: string } }>('/api/sessions', input),
  mySessions: () => api.get<{ data: SessionSummary[] }>('/api/my/sessions'),
  games: (sessionId: string) =>
    api.get<{ data: GameLog[] }>(`/api/sessions/${sessionId}/games`),
  getView: (sessionId: string) =>
    api.get<{ data: SessionView }>(`/api/sessions/${sessionId}`),
  getPlayers: (sessionId: string) =>
    api.get<{ data: SessionPlayer[] }>(`/api/sessions/${sessionId}/players`),
  addPlayer: (sessionId: string, displayName: string) =>
    api.post<{ data: SessionPlayer }>(`/api/sessions/${sessionId}/players`, {
      display_name: displayName,
    }),
  setLevel: (sessionId: string, playerId: string, level: number) =>
    api.post<{ data: SessionPlayer }>(
      `/api/sessions/${sessionId}/players/${playerId}/level`,
      { level }
    ),
  close: (sessionId: string) => api.post(`/api/sessions/${sessionId}/close`),
  addCourt: (sessionId: string) => api.post(`/api/sessions/${sessionId}/courts`),
  renameCourt: (sessionId: string, courtId: string, name: string) =>
    api.put(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/name`, { name }),
  removeCourt: (sessionId: string, courtId: string) =>
    api.delete(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}`),
  endCourt: (sessionId: string, courtId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/end`),
  kick: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/kick`, { player_id: playerId }),
  addPlaying: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/add-playing`, { player_id: playerId }),
}

export const adminApi = {
  listOrgs: () => api.get<{ data: Org[] }>('/api/admin/orgs'),
  createOrg: (email: string, orgName: string) =>
    api.post<{ data: Org }>('/api/admin/orgs', { email, org_name: orgName }),
  deleteOrg: (orgId: string) => api.delete(`/api/admin/orgs/${orgId}`),
  setDisabled: (orgId: string, disabled: boolean) =>
    api.post<{ data: Org }>(`/api/admin/orgs/${orgId}/disabled`, { disabled }),
  impersonate: (orgId: string) =>
    api.post<{ data: { token: string; org: Org } }>(`/api/admin/impersonate/${orgId}`),
  listSessions: () => api.get<{ data: SessionSummary[] }>('/api/admin/sessions'),
}
