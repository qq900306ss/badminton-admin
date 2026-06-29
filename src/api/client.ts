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
  avatar_url?: string // 團主頭像(emoji 或照片網址),空=預設 🐰
  role: 'superadmin' | 'leader'
  disabled?: boolean
}


export interface PlayerSlot {
  player_id: string
  display_name: string
  level: number
  games: number
  avatar_url?: string
}

export interface CourtView {
  court_id: string
  court_num: number
  name?: string
  status: 'empty' | 'playing'
  playing: PlayerSlot[]
  queue: PlayerSlot[]
  started_at?: string
  can_undo?: boolean
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
  title?: string
  city?: string
  district?: string
  num_courts: number
  status: string
  start_at?: string
  end_at?: string
  queue_open_at?: string
  contact_url?: string // 團主自填的聯繫/報名連結(外部,選填)
  courts: CourtView[]
}

export interface SessionPlayer {
  player_id: string
  display_name: string
  level: number
  claimed: boolean
  games: number
  total_minutes: number
  paid: boolean
  is_temp: boolean
  avatar_url?: string
  owner_id?: string // 家人子身份:帶它來的手機帳號
  pending?: boolean // 家人待團主核准
}

export interface SessionSummary {
  session_id: string
  org_id: string
  title: string
  city?: string
  district?: string
  num_courts: number
  status: string
  start_at?: string
  end_at?: string
  queue_open_at?: string
  opened_at: string
}

export interface ActionLog {
  session_id: string
  ts_id: string
  actor: string
  action: string
  detail: string
  at: string
}

export interface CreateSessionInput {
  title: string
  city?: string
  district?: string
  password: string
  num_courts: number
  player_names: string[]
  start_at?: string
  end_at?: string
  queue_open_at?: string
  contact_url?: string
}

export const authApi = {
  google: (code: string) =>
    api.post<{ data: { token: string; org: Org } }>('/api/auth/google', { code }),
  me: () => api.get<{ data: Org }>('/api/auth/me'),
}

export const sessionApi = {
  create: (input: CreateSessionInput) =>
    api.post<{ data: { session_id: string } }>('/api/sessions', input),
  mySessions: () => api.get<{ data: SessionSummary[] }>('/api/my/sessions'),
  sendFeedback: (message: string) => api.post('/api/my/feedback', { message }),
  renameMyOrg: (orgName: string) => api.put<{ data: Org }>('/api/my/org', { org_name: orgName }),
  setMyOrgAvatar: (avatarUrl: string) =>
    api.put<{ data: Org }>('/api/my/org/avatar', { avatar_url: avatarUrl }),
  orgAvatarUploadUrl: (contentType: string) =>
    api.post<{ data: { upload_url: string; public_url: string } }>(
      '/api/my/org/avatar-upload-url',
      { content_type: contentType }
    ),
  games: (sessionId: string) =>
    api.get<{ data: GameLog[] }>(`/api/sessions/${sessionId}/games`),
  actionLogs: (sessionId: string) =>
    api.get<{ data: ActionLog[] }>(`/api/sessions/${sessionId}/action-logs`),
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
  setPlayerName: (sessionId: string, playerId: string, name: string) =>
    api.post<{ data: SessionPlayer }>(
      `/api/sessions/${sessionId}/players/${playerId}/name`,
      { name }
    ),
  setPaid: (sessionId: string, playerId: string, paid: boolean) =>
    api.post<{ data: SessionPlayer }>(
      `/api/sessions/${sessionId}/players/${playerId}/paid`,
      { paid }
    ),
  approveFamily: (sessionId: string, playerId: string) =>
    api.post<{ data: SessionPlayer }>(
      `/api/sessions/${sessionId}/players/${playerId}/approve`
    ),
  removePlayer: (sessionId: string, playerId: string) =>
    api.delete(`/api/sessions/${sessionId}/players/${playerId}`),
  close: (sessionId: string) => api.post(`/api/sessions/${sessionId}/close`),
  hide: (sessionId: string) => api.post(`/api/sessions/${sessionId}/hide`),
  getPassword: (sessionId: string) =>
    api.get<{ data: { password: string } }>(`/api/sessions/${sessionId}/password`),
  setPassword: (sessionId: string, password: string) =>
    api.put<{ data: { password: string } }>(`/api/sessions/${sessionId}/password`, { password }),
  setTitle: (sessionId: string, title: string) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/title`, { title }),
  setLocation: (sessionId: string, city: string, district: string) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/location`, { city, district }),
  setContact: (sessionId: string, contactUrl: string) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/contact`, { contact_url: contactUrl }),
  setTimes: (
    sessionId: string,
    times: { start_at: string; end_at: string; queue_open_at: string }
  ) => api.put(`/api/sessions/${sessionId}/times`, times),
  addCourt: (sessionId: string) => api.post(`/api/sessions/${sessionId}/courts`),
  renameCourt: (sessionId: string, courtId: string, name: string) =>
    api.put(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/name`, { name }),
  removeCourt: (sessionId: string, courtId: string) =>
    api.delete(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}`),
  endCourt: (sessionId: string, courtId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/end`),
  undoEnd: (sessionId: string, courtId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/undo-end`),
  kick: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/kick`, { player_id: playerId }),
  addPlaying: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/add-playing`, { player_id: playerId }),
  addQueue: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/add-queue`, { player_id: playerId }),
}

// on-site seating board: leader-authorized, but with the SAME rules as the
// player front-end (in-progress courts stay locked). Uses dedicated leader
// endpoints with the target player in the body (leader JWT auto-attached).
export const seatApi = {
  joinPlaying: (sessionId: string, courtId: string, playerId: string, position: number) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/seat-playing`,
      { player_id: playerId, position }),
  joinQueue: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/seat-queue`,
      { player_id: playerId }),
  leavePlaying: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/unseat-playing`,
      { player_id: playerId }),
  leaveQueue: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/unseat-queue`,
      { player_id: playerId }),
}

export const adminApi = {
  listOrgs: () => api.get<{ data: Org[] }>('/api/admin/orgs'),
  createOrg: (email: string, orgName: string) =>
    api.post<{ data: Org }>('/api/admin/orgs', { email, org_name: orgName }),
  deleteOrg: (orgId: string) => api.delete(`/api/admin/orgs/${orgId}`),
  renameOrg: (orgId: string, orgName: string) =>
    api.post<{ data: Org }>(`/api/admin/orgs/${orgId}/name`, { org_name: orgName }),
  setDisabled: (orgId: string, disabled: boolean) =>
    api.post<{ data: Org }>(`/api/admin/orgs/${orgId}/disabled`, { disabled }),
  impersonate: (orgId: string) =>
    api.post<{ data: { token: string; org: Org } }>(`/api/admin/impersonate/${orgId}`),
  listSessions: () => api.get<{ data: SessionSummary[] }>('/api/admin/sessions'),
  listFeedback: () => api.get<{ data: Feedback[] }>('/api/admin/feedback'),
  listPlayers: () => api.get<{ data: AdminPlayer[] }>('/api/admin/players'),
}

export interface AdminPlayer {
  player_id: string
  provider: 'google' | 'line'
  display_name: string // 登入時的名字
  join_name?: string // 現在使用的名稱
  avatar_url?: string // 現在使用的頭像(emoji 或照片網址)
  photo_url?: string // 登入提供的大頭貼
  default_level?: number
  email?: string
  created_at: string
}

export interface Feedback {
  id: string
  role: 'player' | 'leader'
  author_id: string
  author_name: string
  email?: string
  message: string
  created_at: string
}
