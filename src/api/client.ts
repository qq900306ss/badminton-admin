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
  created_at?: string
}


export interface PlayerSlot {
  player_id: string
  display_name: string
  level: number
  games: number
  avatar_url?: string
  account_ref?: string // 封鎖用的穩定匿名識別碼(臨時加的人沒有)
}

export interface CourtView {
  court_id: string
  court_num: number
  name?: string
  locked?: boolean // 團主鎖定中:玩家端不能自助上場/排隊
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
  announcement?: string // 場內公告(團主寫給場內成員,選填)
  // 前台報名
  description?: string // 團簡介(選填,公開)
  signup_open?: boolean // 開放前台報名
  signup_quota?: number // 收人名額(0=不限,軟上限)
  joined_count?: number // 已加入人數(非 pending)
  pending_signups?: number // 報名中(等核准)人數
  // 進階:公平讓分
  show_games?: boolean
  fair_play?: boolean
  fair_grace_games?: number
  fair_threshold?: number
  fair_avg?: number // 即時平均(顯示用)
  fair_limit?: number // 封鎖線 = 平均 + X
  fair_active?: number // 目前在輪人數
  fair_enforced?: boolean // 目前是否真的在限制(人數足夠)
  courts: CourtView[]
}

export interface AdvancedSettings {
  show_games?: boolean
  fair_play?: boolean
  fair_grace_games?: number
  fair_threshold?: number
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
  pending?: boolean // 待團主核准(家人或前台報名)
  is_signup?: boolean // 從前台報名進來(pending 期間顯示在報名審核區)
  signup_msg?: string // 報名留言
  account_ref?: string // 封鎖用的穩定匿名識別碼(臨時加的人沒有)
  reserved?: boolean // 團主從 FB/LINE 收到報名、貼進來的名單(到場前 claimed=false = 還沒到)
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
  playing_courts?: number // 目前正在開打的球場數(僅超級後台列表會帶)
  opened_at: string
  // 前台報名(counts 對進行中場次計算)
  description?: string
  signup_open?: boolean
  signup_quota?: number
  joined_count?: number
  played_count?: number // 實際上場打過至少一場的人數
  pending_signups?: number
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
  description?: string
  signup_open?: boolean
  signup_quota?: number
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
  // size 會簽進上傳網址(後端限 3MB),實際檔案大小不同 S3 會拒絕
  orgAvatarUploadUrl: (contentType: string, size: number) =>
    api.post<{ data: { upload_url: string; public_url: string } }>(
      '/api/my/org/avatar-upload-url',
      { content_type: contentType, size }
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
  // 點名:一次貼上報名名單(一行一個名字)→ 都列為「已報名・未到」
  addReserved: (sessionId: string, names: string[]) =>
    api.post<{ data: SessionPlayer[] }>(`/api/sessions/${sessionId}/players/bulk`, { names }),
  // 點名:到了 / 還沒到
  setArrived: (sessionId: string, playerId: string, arrived: boolean) =>
    api.post<{ data: SessionPlayer }>(`/api/sessions/${sessionId}/players/${playerId}/arrived`, { arrived }),
  // 報名名單上的名字 ← 對應到用 App 加入的那個人(合併成一位,算已到)
  linkReserved: (sessionId: string, reservedId: string, fromPlayerId: string) =>
    api.post<{ data: SessionPlayer }>(`/api/sessions/${sessionId}/players/${reservedId}/link`, { from_player_id: fromPlayerId }),
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
  setDescription: (sessionId: string, description: string) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/description`, { description }),
  setAnnouncement: (sessionId: string, announcement: string) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/announcement`, { announcement }),
  setSignupSettings: (sessionId: string, s: { signup_open?: boolean; signup_quota?: number }) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/signup-settings`, s),
  setAdvanced: (sessionId: string, s: AdvancedSettings) =>
    api.put<{ data: SessionView }>(`/api/sessions/${sessionId}/advanced`, s),
  setTimes: (
    sessionId: string,
    times: { start_at: string; end_at: string; queue_open_at: string }
  ) => api.put(`/api/sessions/${sessionId}/times`, times),
  addCourt: (sessionId: string) => api.post(`/api/sessions/${sessionId}/courts`),
  renameCourt: (sessionId: string, courtId: string, name: string) =>
    api.put(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/name`, { name }),
  removeCourt: (sessionId: string, courtId: string) =>
    api.delete(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}`),
  // expectPlaying = 按下當下看到的場上名單;後端比對不符(剛被投票結束)回 409,不會誤結束下一組
  endCourt: (sessionId: string, courtId: string, expectPlaying: string[]) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/end`, { expect_playing: expectPlaying }),
  undoEnd: (sessionId: string, courtId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/undo-end`),
  kick: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/kick`, { player_id: playerId }),
  addPlaying: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/add-playing`, { player_id: playerId }),
  addQueue: (sessionId: string, courtId: string, playerId: string) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/add-queue`, { player_id: playerId }),
  swapQueue: (sessionId: string, args: { court_a: string; players_a: string[]; court_b: string; players_b: string[] }) =>
    api.post(`/api/sessions/${sessionId}/swap-queue`, args),
  lockCourt: (sessionId: string, courtId: string, locked: boolean) =>
    api.post(`/api/sessions/${sessionId}/courts/${encodeURIComponent(courtId)}/lock`, { locked }),
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
  // 每個帳號的打球統計(名單保留 ~90 天,只算這段期間)
  playerStats: () => api.get<{ data: Record<string, PlayerStats> }>('/api/admin/players/stats'),
  // 成員詳情:加入過的團、最近幾團的比賽與球伴
  playerActivity: (playerId: string) =>
    api.get<{ data: PlayerActivity }>(`/api/admin/players/${encodeURIComponent(playerId)}/activity`),
  // 停權/解除停權:立即生效(後端 middleware 擋掉該帳號的玩家 API 與登入)
  setPlayerBanned: (playerId: string, banned: boolean) =>
    api.post<{ data: { banned: boolean } }>(`/api/admin/players/${encodeURIComponent(playerId)}/ban`, { banned }),
  // 清除名稱與頭像:帳號名稱清空、頭像回預設,開放中場次的名字改「球友」
  resetPlayerProfile: (playerId: string) =>
    api.post<{ data: { reset: boolean } }>(`/api/admin/players/${encodeURIComponent(playerId)}/reset-profile`),
  // 檢舉(含封鎖時自動寫的那筆);預設只拿待處理
  listReports: (status: 'open' | 'all') =>
    api.get<{ data: Report[] }>('/api/admin/reports', { params: { status } }),
  resolveReport: (id: string, note: string) =>
    api.post<{ data: { resolved: boolean } }>('/api/admin/reports/resolve', { id, note }),
}

export interface PlayerStats {
  sessions: number // 加入過幾團
  played_in: number // 其中真的上場過的團數
  games: number
  minutes: number
  last_session_id?: string
  last_session_at?: string // 最近一團的開打時間
  org_ids?: string[] // 加入過哪些團主的團
}

export interface ActivitySession {
  session_id: string
  title: string
  org_id: string
  status: string
  at: string
  name: string // 他在這團用的名字
  level: number
  games: number
  minutes: number
  paid: boolean
  pending?: boolean
  missing?: boolean // 場次已被刪,只剩名單
}

export interface Partner {
  account_id?: string // 有帳號才有(可以點過去看他)
  name: string
  games: number
  last_at: string
}

export interface ActivityGame {
  session_id: string
  court_num: number
  started_at: string
  ended_at: string
  minutes: number
  with: string[]
}

export interface PlayerActivity {
  sessions: ActivitySession[]
  partners: Partner[]
  games: ActivityGame[]
  games_from_count: number // 球伴/比賽是從最近幾團算的
}

export interface AdminPlayer {
  player_id: string
  provider: 'google' | 'line' | 'apple'
  display_name: string // 登入時的名字
  join_name?: string // 現在使用的名稱
  avatar_url?: string // 現在使用的頭像(emoji 或照片網址)
  photo_url?: string // 登入提供的大頭貼
  default_level?: number
  email?: string
  banned?: boolean // 超管停權中
  created_at: string
  // 來源平台(前台 X-Client 標頭;格式見 lib/clientSource.ts),舊帳號沒有
  signup_client?: string // 註冊(第一次登入)時的平台
  last_client?: string // 最近一次使用的平台
  last_seen_at?: string // 最近使用時間(RFC3339 UTC)
}

export type ReportReason = 'inappropriate' | 'harassment' | 'spam' | 'other' | 'blocked'

// 玩家檢舉(reason=blocked 是玩家封鎖對方時自動寫的那筆)。
// target_* / session_* 是檢舉當下的內容快照 — 就算對方之後改掉,超管還看得到原文。
export interface Report {
  id: string // ts_id
  reporter_id: string
  reporter_name: string
  target_type: 'player' | 'session'
  session_id: string
  session_player_id?: string
  target_account_id?: string // player 型:被檢舉的帳號(家人 → 帶他來的帳號);團主手動加的名字沒有
  target_org_id: string
  target_name?: string
  target_avatar_url?: string
  session_title?: string
  session_description?: string
  session_announcement?: string
  reason: ReportReason
  detail?: string
  status: 'open' | 'resolved'
  resolved_at?: string
  resolved_note?: string
  created_at: string
  client?: string // 檢舉人送出時的平台
}

export interface Feedback {
  id: string
  role: 'player' | 'leader'
  author_id: string
  author_name: string
  email?: string
  message: string
  created_at: string
  client?: string // 送出時的平台
}
