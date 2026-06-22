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
}

export interface CourtView {
  court_id: string
  court_num: number
  status: 'empty' | 'playing'
  playing: PlayerSlot[]
  queue: PlayerSlot[]
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
  is_temp: boolean
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
  create: (password: string, numCourts: number, playerNames: string[]) =>
    api.post<{ data: { session_id: string } }>('/api/sessions', {
      password,
      num_courts: numCourts,
      player_names: playerNames,
    }),
  getView: (sessionId: string) =>
    api.get<{ data: SessionView }>(`/api/sessions/${sessionId}`),
  getPlayers: (sessionId: string) =>
    api.get<{ data: SessionPlayer[] }>(`/api/sessions/${sessionId}/players`),
  addPlayer: (sessionId: string, displayName: string) =>
    api.post<{ data: SessionPlayer }>(`/api/sessions/${sessionId}/players`, {
      display_name: displayName,
    }),
  close: (sessionId: string) => api.post(`/api/sessions/${sessionId}/close`),
  addCourt: (sessionId: string) => api.post(`/api/sessions/${sessionId}/courts`),
  endCourt: (sessionId: string, courtId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${courtId}/end`),
  kick: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${courtId}/kick`, { player_id: playerId }),
  addPlaying: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${courtId}/add-playing`, { player_id: playerId }),
}

export const adminApi = {
  listOrgs: () => api.get<{ data: Org[] }>('/api/admin/orgs'),
  createOrg: (email: string, orgName: string) =>
    api.post<{ data: Org }>('/api/admin/orgs', { email, org_name: orgName }),
  deleteOrg: (orgId: string) => api.delete(`/api/admin/orgs/${orgId}`),
}
