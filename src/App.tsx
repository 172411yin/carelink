import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, AlertCircle, ArrowRight, CalendarDays, Check, ChevronRight, CircleUserRound,
  ClipboardList, Droplets, HeartPulse, Home, Info, LocateFixed, MapPin, Menu, Moon,
  Package, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Sun,
  Trash2, TrendingUp, UserRound, X, Zap,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cloudEnabled, supabase, createHousehold, joinHousehold } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Tab = 'home' | 'health' | 'meds' | 'map' | 'me'
type Theme = 'light' | 'dark' | 'system'
type Medicine = { id: string; name: string; type: string; purpose: string; quantity: number; unit: string; expiry: string; threshold: number; location: string; note: string }
type SymptomLog = { id: string; type: string; createdAt: string; severity: number; duration: string; note: string; care: string; medicine?: string }
type Point = { lat: number; lng: number }

const symptomInfo = [
  { id: 'digestive', name: '消化不良', subtitle: '胃胀 · 肚子不舒服', icon: Droplets, tone: 'mint', intro: '短暂的腹胀、嗳气或胃部不适，常与饮食节奏和压力有关。', tips: ['少量多餐，细嚼慢咽，饭后保持轻松活动。', '记录可能诱因，例如过饱、辛辣或进食过快。', '不适持续加重、伴剧烈疼痛或呕吐时及时就医。'] },
  { id: 'period', name: '经期不适', subtitle: '痛经 · 需要温柔照顾', icon: HeartPulse, tone: 'rose', intro: '经期的下腹部不适较常见，充分休息和温热护理可以帮助舒缓。', tips: ['尝试热敷、补充水分和轻柔伸展。', '安排低强度活动，按身体感受调整节奏。', '突然出现剧烈疼痛、晕厥或异常出血时寻求医疗帮助。'] },
  { id: 'back', name: '腰部不适', subtitle: '腰痛 · 姿势与活动', icon: Activity, tone: 'blue', intro: '腰部不适可能与久坐、姿势或近期活动量变化有关。', tips: ['避免长时间保持同一姿势，定时起身活动。', '在不加重疼痛的范围内进行轻柔活动。', '伴随腿部无力、麻木或大小便异常时立即就医。'] },
]

const initialMedicines: Medicine[] = [
  { id: 'm1', name: '维生素 C', type: '营养补充', purpose: '日常营养补充', quantity: 18, unit: '片', expiry: '2026-09-30', threshold: 10, location: '厨房抽屉', note: '演示数据 · 请按包装说明使用' },
  { id: 'm2', name: '暖宝宝贴', type: '护理用品', purpose: '经期热敷护理', quantity: 4, unit: '片', expiry: '2027-02-18', threshold: 3, location: '卧室柜', note: '演示数据 · 避免直接接触皮肤过久' },
  { id: 'm3', name: '口服补液盐', type: '家庭常备', purpose: '补充水分和电解质', quantity: 2, unit: '袋', expiry: '2026-03-12', threshold: 3, location: '家庭药箱', note: '演示数据 · 具体使用请咨询医生或药师' },
]

const initialLogs: SymptomLog[] = [
  { id: 'l1', type: '消化不良', createdAt: '2026-10-29T09:30:00', severity: 3, duration: '2 小时', note: '早餐后有轻微胀气', care: '散步、少量饮水' },
  { id: 'l2', type: '腰部不适', createdAt: '2026-10-27T18:15:00', severity: 4, duration: '半天', note: '久坐后出现', care: '热敷、伸展' },
  { id: 'l3', type: '经期不适', createdAt: '2026-10-24T12:10:00', severity: 5, duration: '3 小时', note: '', care: '休息、热敷' },
]

const load = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function cloudMedicineToLocal(row: { id: string; name: string; type: string; purpose: string; quantity: number; unit: string; expiry: string; threshold: number; location: string; note: string }): Medicine {
  return { id: row.id, name: row.name, type: row.type, purpose: row.purpose, quantity: row.quantity, unit: row.unit, expiry: row.expiry, threshold: row.threshold, location: row.location, note: row.note }
}
function cloudLogToLocal(row: { id: string; type: string; created_at: string; severity: number; duration: string; note: string; care: string; medicine?: string | null }): SymptomLog {
  return { id: row.id, type: row.type, createdAt: row.created_at, severity: row.severity, duration: row.duration, note: row.note, care: row.care, medicine: row.medicine ?? undefined }
}
function localLogToCloud(log: SymptomLog, householdId: string) {
  return { id: log.id, household_id: householdId, type: log.type, created_at: log.createdAt, severity: log.severity, duration: log.duration, note: log.note, care: log.care, medicine: log.medicine ?? null }
}

function AuthPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [mode, setMode] = useState<'signin' | 'signup'>('signin'); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!supabase) return; setBusy(true); setMessage(''); const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); setBusy(false); if (result.error) setMessage(result.error.message); else if (mode === 'signup') setMessage('注册成功。若启用了邮箱验证，请先完成验证后登录。') }
  return <div className="auth-shell"><div className="auth-brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>CareLink</span></div><form className="auth-card" onSubmit={submit}><p className="eyebrow">安心健康管家</p><h1>{mode === 'signin' ? '欢迎回来' : '创建你的账号'}</h1><p className="subtitle">登录后，你和重要的人可以共享同一个家庭空间。</p><label>邮箱<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>密码<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位字符" /></label>{message && <div className="auth-message"><Info size={15} />{message}</div>}<button className="primary-button full" disabled={busy}>{busy ? '处理中…' : mode === 'signin' ? '登录 CareLink' : '注册账号'}</button><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? '还没有账号？创建一个' : '已有账号？返回登录'}</button></form><p className="auth-note"><ShieldCheck size={14} />由 Supabase 提供身份认证，密码不会写入 CareLink。</p></div>
}

function HouseholdPage({ email, onConnected, onSignOut }: { email: string; onConnected: (id: string) => void; onSignOut: () => void }) {
  const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [inviteCode, setInviteCode] = useState(''); const [createdHouseholdId, setCreatedHouseholdId] = useState('')
  const create = async () => { setBusy(true); setMessage(''); try { const result = await createHousehold(); setInviteCode(result.invite_code); setCreatedHouseholdId(result.household_id) } catch (error) { setMessage(error instanceof Error ? error.message : '创建家庭空间失败') } finally { setBusy(false) } }
  const join = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { const result = await joinHousehold(code); onConnected(result.household_id) } catch (error) { setMessage(error instanceof Error ? error.message : '加入家庭空间失败') } finally { setBusy(false) } }
  return <div className="auth-shell"><div className="auth-brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>CareLink</span></div><div className="auth-card household-card"><p className="eyebrow">第一步</p><h1>建立你们的家庭空间</h1><p className="subtitle">当前账号：{email}。创建空间后，把邀请码发给另一位成员。</p>{!inviteCode && <button className="primary-button full" onClick={() => void create()} disabled={busy}><Plus size={17} />创建新的家庭空间</button>}{inviteCode && <><div className="invite-result"><span>邀请码</span><strong>{inviteCode}</strong><small>让对方登录后输入这 8 位邀请码</small></div><button className="primary-button full" onClick={() => onConnected(createdHouseholdId)}><Check size={17} />已分享，进入家庭空间</button></>}<div className="auth-divider"><span>或</span></div><form onSubmit={join}><label>输入对方的邀请码<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="例如 A1B2C3D4" /></label><button className="outline-button full" disabled={busy || code.length < 8}><UserRound size={17} />加入家庭空间</button></form>{message && <div className="auth-message"><Info size={15} />{message}</div>}<button className="auth-switch" onClick={onSignOut}>退出登录</button></div></div>
}

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [theme, setTheme] = useState<Theme>(load('carelink-theme', 'system'))
  const [medicines, setMedicines] = useState<Medicine[]>(load('carelink-medicines', initialMedicines))
  const [logs, setLogs] = useState<SymptomLog[]>(load('carelink-logs', initialLogs))
  const [showMedicineForm, setShowMedicineForm] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null)
  const [showLogForm, setShowLogForm] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState(symptomInfo[0])
  const [toast, setToast] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(cloudEnabled)
  const [householdId, setHouseholdId] = useState<string | null>(cloudEnabled ? null : load('carelink-household-id', null))
  const [cloudReady, setCloudReady] = useState(!cloudEnabled)
  const [remoteError, setRemoteError] = useState('')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    client.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setAuthLoading(false) } })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase
    let active = true
    const loadMembership = async () => {
      const { data, error } = await client.from('household_members').select('household_id').eq('user_id', session.user.id).limit(1).maybeSingle()
      if (!active) return
      if (error) { setRemoteError(error.message); return }
      setHouseholdId(data?.household_id ?? null)
      if (data?.household_id) localStorage.setItem('carelink-household-id', data.household_id)
      else localStorage.removeItem('carelink-household-id')
    }
    loadMembership()
    return () => { active = false }
  }, [session])
  useEffect(() => {
    if (!supabase || !session || !householdId) return
    const client = supabase
    let active = true
    const loadCloudData = async () => {
      const [medicineResult, logResult] = await Promise.all([
        client.from('medicines').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
        client.from('symptom_logs').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
      ])
      if (!active) return
      if (medicineResult.error || logResult.error) { setRemoteError(medicineResult.error?.message || logResult.error?.message || '读取共享数据失败'); return }
      setMedicines((medicineResult.data ?? []).map(cloudMedicineToLocal))
      setLogs((logResult.data ?? []).map(cloudLogToLocal))
      setCloudReady(true)
    }
    setCloudReady(false)
    loadCloudData()
    const channel = client.channel(`household-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines', filter: `household_id=eq.${householdId}` }, loadCloudData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'symptom_logs', filter: `household_id=eq.${householdId}` }, loadCloudData)
      .subscribe()
    return () => { active = false; void client.removeChannel(channel) }
  }, [session, householdId])
  useEffect(() => { if (!cloudEnabled) localStorage.setItem('carelink-medicines', JSON.stringify(medicines)) }, [medicines])
  useEffect(() => { if (!cloudEnabled) localStorage.setItem('carelink-logs', JSON.stringify(logs)) }, [logs])
  useEffect(() => {
    localStorage.setItem('carelink-theme', theme)
    const root = document.documentElement
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.dataset.theme = dark ? 'dark' : 'light'
  }, [theme])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast])

  const lowStock = medicines.filter(m => m.quantity <= m.threshold)
  const expiring = medicines.filter(m => new Date(m.expiry).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45)
  const chartData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - i))
    const key = date.toISOString().slice(0, 10)
    return { day: `${date.getMonth() + 1}/${date.getDate()}`, count: logs.filter(l => l.createdAt.slice(0, 10) === key).length }
  }), [logs])

  const persistMedicine = async (medicine: Medicine) => {
    if (cloudEnabled && (!householdId || !cloudReady)) { setRemoteError('共享空间尚未准备好，请稍后重试'); return }
    setMedicines(current => current.some(item => item.id === medicine.id) ? current.map(item => item.id === medicine.id ? medicine : item) : [medicine, ...current])
    if (!supabase || !householdId) return
    const { error } = await supabase.from('medicines').upsert({ ...medicine, household_id: householdId }, { onConflict: 'id' })
    if (error) setRemoteError(error.message)
  }
  const deleteMedicine = async (id: string) => {
    if (cloudEnabled && (!householdId || !cloudReady)) { setRemoteError('共享空间尚未准备好，请稍后重试'); return }
    setMedicines(current => current.filter(m => m.id !== id))
    if (supabase && householdId) { const { error } = await supabase.from('medicines').delete().eq('id', id).eq('household_id', householdId); if (error) setRemoteError(error.message) }
  }
  const persistLog = async (log: SymptomLog) => {
    if (cloudEnabled && (!householdId || !cloudReady)) { setRemoteError('共享空间尚未准备好，请稍后重试'); return }
    setLogs(current => [log, ...current])
    if (!supabase || !householdId) return
    const { error } = await supabase.from('symptom_logs').insert(localLogToCloud(log, householdId))
    if (error) setRemoteError(error.message)
  }
  const addLog = (log: SymptomLog) => { void persistLog(log); setShowLogForm(false); setToast('已保存这次不适记录') }
  const updateQuantity = (id: string, delta: number) => { const medicine = medicines.find(m => m.id === id); if (medicine) void persistMedicine({ ...medicine, quantity: Math.max(0, medicine.quantity + delta) }) }
  const removeMedicine = (id: string) => { void deleteMedicine(id); setToast('已删除药品') }
  const clearData = async () => {
    if (supabase && householdId) {
      const [medicineResult, logResult] = await Promise.all([
        supabase.from('medicines').delete().eq('household_id', householdId),
        supabase.from('symptom_logs').delete().eq('household_id', householdId),
      ])
      if (medicineResult.error || logResult.error) { setRemoteError(medicineResult.error?.message || logResult.error?.message || '清除共享数据失败'); return }
    }
    setMedicines([]); setLogs([]); setToast('共享记录已清除')
  }

  if (authLoading) return <div className="loading-screen"><ShieldCheck size={28} /><span>正在连接 CareLink…</span></div>
  if (cloudEnabled && !session) return <AuthPage />
  if (cloudEnabled && session && !householdId) return <HouseholdPage email={session.user.email ?? ''} onConnected={id => { setHouseholdId(id); localStorage.setItem('carelink-household-id', id) }} onSignOut={() => { setHouseholdId(null); localStorage.removeItem('carelink-household-id'); void supabase?.auth.signOut() }} />
  if (cloudEnabled && session && householdId && !cloudReady) return <div className="loading-screen"><ShieldCheck size={28} /><span>{remoteError || '正在载入家庭共享数据…'}</span>{remoteError && <button className="outline-button" onClick={() => window.location.reload()}>重新连接</button>}</div>

  const content: Record<Tab, ReactNode> = {
    home: <HomePage medicines={medicines} logs={logs} lowStock={lowStock} expiring={expiring} onTab={setTab} onLog={() => setShowLogForm(true)} />,
    health: <HealthPage logs={logs} selected={selectedSymptom} onSelect={setSelectedSymptom} onLog={() => setShowLogForm(true)} />,
    meds: <MedsPage medicines={medicines} onAdd={() => { setEditingMedicine(null); setShowMedicineForm(true) }} onEdit={m => { setEditingMedicine(m); setShowMedicineForm(true) }} onDelete={removeMedicine} onQuantity={updateQuantity} />,
    map: <MapPage />,
    me: <SettingsPage theme={theme} setTheme={setTheme} medicines={medicines} logs={logs} onClear={() => void clearData()} />,
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={20} /></div><div><strong>CareLink</strong><span>安心健康管家</span></div></div><button className="icon-button" aria-label="个人资料" onClick={() => setTab('me')}><CircleUserRound size={22} /></button></header>
    <main className="page-content">{remoteError && <div className="sync-error"><AlertCircle size={16} /><span>{remoteError}</span><button onClick={() => setRemoteError('')} aria-label="关闭提示"><X size={14} /></button></div>}{cloudEnabled && <div className="sync-pill"><span className="sync-dot" />共享家庭空间 · 实时同步</div>}{content[tab]}</main>
    <nav className="tabbar">{([['home', Home, '首页'], ['health', HeartPulse, '健康'], ['meds', Package, '药箱'], ['map', MapPin, '地图'], ['me', UserRound, '我的']] as const).map(([id, Icon, label]) => <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}><Icon size={20} strokeWidth={tab === id ? 2.6 : 2} /><span>{label}</span></button>)}</nav>
    {showMedicineForm && <MedicineForm initial={editingMedicine} onClose={() => setShowMedicineForm(false)} onSave={m => { void persistMedicine(m); setShowMedicineForm(false); setToast(editingMedicine ? '药品信息已更新' : '药品已加入药箱') }} />}
    {showLogForm && <LogForm symptom={selectedSymptom.name} onClose={() => setShowLogForm(false)} onSave={addLog} />}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) { return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</div> }
function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section> }
function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) { return <div className="section-label"><h2>{children}</h2>{action}</div> }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Info; title: string; text: string }) { return <div className="empty"><Icon size={22} /><strong>{title}</strong><span>{text}</span></div> }

function HomePage({ medicines, logs, lowStock, expiring, onTab, onLog }: { medicines: Medicine[]; logs: SymptomLog[]; lowStock: Medicine[]; expiring: Medicine[]; onTab: (tab: Tab) => void; onLog: () => void }) {
  const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
  return <><PageHeader eyebrow={today} title="早上好，Lin" subtitle="照顾好自己，也把关心留给重要的人。" action={<div className="avatar">L</div>} />
    <Card className="wellness-card"><div className="wellness-copy"><span className="status-dot">● 今日状态</span><h2>给身体一点从容</h2><p>记录微小感受，持续了解自己的节奏。</p><button className="soft-button" onClick={onLog}><Plus size={16} />记录不适</button></div><div className="wellness-art"><Sparkles size={28} /><span>3</span><small>项健康记录</small></div></Card>
    <div className="metric-grid"><Card><span className="metric-icon mint"><TrendingUp size={17} /></span><strong>{logs.length}</strong><span>本月记录</span><small>保持觉察</small></Card><Card><span className="metric-icon blue"><Package size={17} /></span><strong>{medicines.length}</strong><span>药箱品类</span><small>{lowStock.length ? `${lowStock.length} 项需补充` : '库存充足'}</small></Card><Card><span className="metric-icon rose"><HeartPulse size={17} /></span><strong>良好</strong><span>今日状态</span><small>根据你的记录</small></Card></div>
    <SectionLabel action={<button className="text-button" onClick={() => onTab('health')}>查看全部 <ArrowRight size={14} /></button>}>快捷入口</SectionLabel>
    <div className="quick-grid"><button className="quick-card mint-bg" onClick={() => onTab('health')}><span><HeartPulse size={22} /></span><strong>身体不适</strong><small>了解护理建议</small><ChevronRight /></button><button className="quick-card blue-bg" onClick={() => onTab('meds')}><span><Package size={22} /></span><strong>家庭药箱</strong><small>{lowStock.length ? '有库存提醒' : '一切准备就绪'}</small><ChevronRight /></button><button className="quick-card lavender-bg" onClick={() => onTab('map')}><span><MapPin size={22} /></span><strong>双人地图</strong><small>和重要的人保持连接</small><ChevronRight /></button></div>
    <SectionLabel action={<button className="text-button" onClick={() => onTab('meds')}>管理药箱 <ArrowRight size={14} /></button>}>需要留意</SectionLabel>
    <Card className="notice-list">{lowStock.length === 0 && expiring.length === 0 ? <EmptyState icon={Check} title="目前没有提醒" text="药箱状态看起来不错。" /> : <>{lowStock.slice(0, 2).map(m => <div className="notice-row" key={m.id}><div className="notice-icon amber"><AlertCircle size={18} /></div><div><strong>{m.name}库存偏低</strong><span>还剩 {m.quantity} {m.unit}，建议及时补充</span></div><ChevronRight size={17} /></div>)}{expiring.slice(0, 2).map(m => <div className="notice-row" key={`e-${m.id}`}><div className="notice-icon rose"><CalendarDays size={18} /></div><div><strong>{m.name}即将到期</strong><span>有效期至 {m.expiry}</span></div><ChevronRight size={17} /></div>)}</>}</Card>
    <Card className="care-card"><div className="care-avatar">S</div><div><span className="eyebrow">双人关怀</span><strong>Shan 的位置分享</strong><span className="online"><i />演示位置 · 12 分钟前更新</span></div><button className="circle-arrow" onClick={() => onTab('map')}><ArrowRight size={17} /></button></Card>
  </>
}

function HealthPage({ logs, selected, onSelect, onLog }: { logs: SymptomLog[]; selected: typeof symptomInfo[number]; onSelect: (item: typeof symptomInfo[number]) => void; onLog: () => void }) {
  return <><PageHeader eyebrow="健康空间" title="了解身体的信号" subtitle="来自可靠常识的日常护理参考。" action={<button className="primary-button compact" onClick={onLog}><Plus size={17} />记录</button>} />
    <SectionLabel>常见不适</SectionLabel><div className="symptom-row">{symptomInfo.map(item => { const Icon = item.icon; return <button className={`symptom-card ${selected.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item)}><span className={`symptom-icon ${item.tone}`}><Icon size={21} /></span><strong>{item.name}</strong><small>{item.subtitle}</small></button> })}</div>
    <Card className="detail-card"><div className="detail-heading"><span className={`symptom-icon ${selected.tone}`}><selected.icon size={23} /></span><div><span className="eyebrow">日常参考</span><h2>{selected.name}</h2></div></div><p>{selected.intro}</p><div className="tip-list">{selected.tips.map((tip, index) => <div key={tip}><span>{String(index + 1).padStart(2, '0')}</span><p>{tip}</p></div>)}</div><div className="disclaimer"><Info size={16} /><span>内容用于健康知识参考和主动记录，不提供自动诊断或个性化用药决定。若症状严重、持续或你处于孕期/有慢性病，请咨询医生或药师。</span></div><button className="outline-button full" onClick={onLog}><ClipboardList size={17} />记录本次不适</button></Card>
    <SectionLabel action={<span className="muted-label">仅统计主动记录</span>}>近 7 日趋势</SectionLabel><Card className="chart-card"><div className="chart-summary"><div><strong>{logs.length}</strong><span>累计记录</span></div><div className="trend-chip"><TrendingUp size={14} />保持觉察</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const key = d.toISOString().slice(0, 10); return { day: `${d.getMonth() + 1}/${d.getDate()}`, count: logs.filter(l => l.createdAt.slice(0, 10) === key).length } })}><defs><linearGradient id="careFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#79b9a4" stopOpacity={0.35} /><stop offset="100%" stopColor="#79b9a4" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis allowDecimals={false} width={18} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} /><Area type="monotone" dataKey="count" stroke="#579f89" strokeWidth={2.5} fill="url(#careFill)" /></AreaChart></ResponsiveContainer></div></Card>
    <SectionLabel>最近记录</SectionLabel><Card className="log-list">{logs.length ? logs.slice(0, 4).map(log => <div className="log-row" key={log.id}><div className="log-date"><strong>{new Date(log.createdAt).getDate()}</strong><span>{new Date(log.createdAt).toLocaleDateString('zh-CN', { month: 'short' })}</span></div><div><strong>{log.type}</strong><span>不适程度 {log.severity}/10 · {log.duration}</span></div><ChevronRight size={17} /></div>) : <EmptyState icon={ClipboardList} title="还没有记录" text="当身体有需要时，从这里开始记录。" />}</Card>
  </>
}

function MedsPage({ medicines, onAdd, onEdit, onDelete, onQuantity }: { medicines: Medicine[]; onAdd: () => void; onEdit: (m: Medicine) => void; onDelete: (id: string) => void; onQuantity: (id: string, delta: number) => void }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('全部')
  const filtered = medicines.filter(m => `${m.name}${m.purpose}${m.type}`.includes(query) && (filter === '全部' || (filter === '低库存' ? m.quantity <= m.threshold : filter === '临期' ? new Date(m.expiry).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45 : m.type === filter)))
  const filters = ['全部', '低库存', '临期', ...Array.from(new Set(medicines.map(m => m.type)))]
  return <><PageHeader eyebrow="家庭药箱" title="准备得刚刚好" subtitle={`${medicines.length} 个品类 · 数据仅保存在此设备`} action={<button className="primary-button compact" onClick={onAdd}><Plus size={17} />添加</button>} /><div className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索药品或用途" /></div><div className="filter-scroll">{filters.map(f => <button className={filter === f ? 'filter active' : 'filter'} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="stock-summary"><div><strong>{medicines.reduce((sum, m) => sum + m.quantity, 0)}</strong><span>总库存</span></div><div><strong className={medicines.filter(m => m.quantity <= m.threshold).length ? 'warning-text' : ''}>{medicines.filter(m => m.quantity <= m.threshold).length}</strong><span>低库存</span></div><div><strong>{medicines.filter(m => new Date(m.expiry).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45).length}</strong><span>临期</span></div></div><div className="medicine-list">{filtered.length ? filtered.map(m => <MedicineRow key={m.id} medicine={m} onEdit={() => onEdit(m)} onDelete={() => onDelete(m.id)} onQuantity={delta => onQuantity(m.id, delta)} />) : <Card><EmptyState icon={Package} title="没有找到药品" text="试试其他关键词，或添加一项新的库存。" /></Card>}</div></>
}

function MedicineRow({ medicine: m, onEdit, onDelete, onQuantity }: { medicine: Medicine; onEdit: () => void; onDelete: () => void; onQuantity: (delta: number) => void }) { const low = m.quantity <= m.threshold; const expired = new Date(m.expiry) < new Date(); return <Card className="medicine-card"><div className="medicine-top"><div className="medicine-icon"><Package size={22} /></div><div className="medicine-title"><strong>{m.name}</strong><span>{m.type} · {m.purpose}</span></div><button className="icon-button subtle" onClick={onEdit} aria-label="编辑药品"><Pencil size={16} /></button><button className="icon-button subtle danger" onClick={onDelete} aria-label="删除药品"><Trash2 size={16} /></button></div><div className="medicine-meta"><div className="quantity-control"><button onClick={() => onQuantity(-1)} aria-label="减少库存">−</button><strong>{m.quantity}</strong><span>{m.unit}</span><button onClick={() => onQuantity(1)} aria-label="增加库存">+</button></div><div className={`stock-badge ${expired ? 'expired' : low ? 'low' : 'ok'}`}>{expired ? '已过期' : low ? '库存偏低' : '库存正常'}</div></div><div className="medicine-footer"><span><CalendarDays size={14} />有效期 {m.expiry}</span><span><MapPin size={14} />{m.location}</span></div></Card> }

function MapPage() { const [me, setMe] = useState<Point | null>(null); const [status, setStatus] = useState('尚未授权当前位置'); const [manual, setManual] = useState(''); const other: Point = { lat: 31.2304, lng: 121.4737 }; const distance = me ? haversine(me, other) : null; const locate = () => { if (!navigator.geolocation) { setStatus('当前浏览器不支持定位'); return } setStatus('正在请求定位权限…'); navigator.geolocation.getCurrentPosition(p => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setStatus('当前位置已授权 · 仅保存在本地') }, () => setStatus('定位未授权，可使用下方手动位置')) }; return <><PageHeader eyebrow="双人关怀" title="在一起，就很近" subtitle="位置分享需要双方明确同意。当前为本地演示模式。" action={<button className="icon-button" onClick={locate} aria-label="获取当前位置"><LocateFixed size={21} /></button>} /><Card className="map-card"><MapCanvas me={me} onStatus={setStatus} /><div className="distance-panel"><div className="care-avatar">S</div><div><span className="eyebrow">Shan · 演示位置</span><strong>{distance ? `${formatDistance(distance)} 直线距离` : '等待你的位置'}</strong><span className="online"><i />主动分享 · 12 分钟前</span></div><ShieldCheck size={18} className="privacy-icon" /></div></Card><div className="map-status"><Info size={17} /><span>{status}</span></div><Card className="manual-card"><div className="section-label"><h2>提供一个位置</h2><span className="muted-label">不上传精确地址</span></div><p>你可以授权浏览器定位，也可以用城市中心点作为本地演示位置。</p><div className="manual-input"><MapPin size={17} /><input value={manual} onChange={e => setManual(e.target.value)} placeholder="例如：上海" /><button onClick={() => { if (manual.trim()) { setMe({ lat: 31.224, lng: 121.469 }); setStatus(`已使用“${manual.trim()}”的演示位置`) } }}>使用</button></div></Card><Card className="privacy-card"><ShieldCheck size={20} /><div><strong>位置隐私</strong><span>未经对方同意不会获取或公开对方位置。跨设备同步、邀请和撤销权限需要后端服务支持。</span></div></Card></> }
function MapCanvas({ me, onStatus }: { me: Point | null; onStatus: (status: string) => void }) { const mapRef = useRef<HTMLDivElement>(null); const mapInstance = useRef<L.Map | null>(null); const markers = useRef<{ other?: L.Marker; me?: L.Marker }>({}); useEffect(() => { if (!mapRef.current) return; const map = L.map(mapRef.current, { zoomControl: false }).setView([31.2304, 121.4737], 11); L.control.zoom({ position: 'topright' }).addTo(map); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map); markers.current.other = L.marker([31.2304, 121.4737], { icon: markerIcon('#9888ae', 'S') }).addTo(map).bindTooltip('Shan · 演示位置', { direction: 'top', offset: [0, -18] }); map.on('zoomend', () => onStatus(`地图缩放至 ${map.getZoom()} 级`)); mapInstance.current = map; return () => { map.remove(); mapInstance.current = null } }, [onStatus]); useEffect(() => { const map = mapInstance.current; if (!map) return; if (markers.current.me) { markers.current.me.remove(); markers.current.me = undefined } if (me) { markers.current.me = L.marker([me.lat, me.lng], { icon: markerIcon('#5fa88f', 'L') }).addTo(map).bindTooltip('我 · 当前位置', { direction: 'top', offset: [0, -18] }); const bounds = L.latLngBounds([[31.2304, 121.4737], [me.lat, me.lng]]); map.fitBounds(bounds.pad(.35), { maxZoom: 13 }); } }, [me]); return <div className="map-surface"><div ref={mapRef} className="leaflet-map" /><div className="map-controls"><button onClick={() => { mapInstance.current?.locate({ setView: true }); onStatus('地图正在尝试定位') }} aria-label="重新定位"><LocateFixed size={17} /></button><button onClick={() => { mapInstance.current?.setView([31.2304, 121.4737], 11); onStatus('地图中心已调整') }} aria-label="回到演示位置"><RefreshCw size={17} /></button></div>{!me && <div className="map-empty"><MapPin size={20} /><span>授权后显示你的位置</span></div>}</div> }
function markerIcon(color: string, label: string) { return L.divIcon({ className: 'care-marker', html: `<span style="background:${color}">${label}</span>`, iconSize: [40, 40], iconAnchor: [20, 40], tooltipAnchor: [0, -32] }) }
function haversine(a: Point, b: Point) { const r = 6371; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) }
function formatDistance(km: number) { return km < 1 ? `${Math.round(km * 1000)} 米` : `${km.toFixed(1)} 公里` }

function SettingsPage({ theme, setTheme, medicines, logs, onClear }: { theme: Theme; setTheme: (theme: Theme) => void; medicines: Medicine[]; logs: SymptomLog[]; onClear: () => void }) { const exportData = () => { const blob = new Blob([JSON.stringify({ medicines, logs, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'carelink-health-data.json'; a.click(); URL.revokeObjectURL(url) }; return <><PageHeader eyebrow="个人空间" title="照顾好自己" subtitle="偏好设置与数据管理" action={<div className="avatar"><UserRound size={18} /></div>} /><Card className="profile-card"><div className="profile-avatar">L</div><div><strong>Lin</strong><span>本地设备用户</span></div><button className="icon-button subtle"><Pencil size={16} /></button></Card><SectionLabel>外观</SectionLabel><Card className="settings-card"><div className="setting-row"><div className="setting-icon"><Sun size={18} /></div><div><strong>显示模式</strong><span>选择你喜欢的界面氛围</span></div></div><div className="segmented">{([['system', '跟随系统', Menu], ['light', '浅色', Sun], ['dark', '深色', Moon]] as const).map(([id, label, Icon]) => <button className={theme === id ? 'selected' : ''} key={id} onClick={() => setTheme(id)}><Icon size={15} />{label}</button>)}</div></Card><SectionLabel>数据与隐私</SectionLabel><Card className="settings-card plain"><button className="setting-action" onClick={exportData}><div className="setting-icon blue"><ArrowRight size={18} /></div><div><strong>导出健康数据</strong><span>下载 JSON 格式的本地记录</span></div><ChevronRight size={17} /></button><button className="setting-action" onClick={() => { if (confirm('确定清除本设备上的本地记录吗？')) onClear() }}><div className="setting-icon rose"><Trash2 size={18} /></div><div><strong>清除本地数据</strong><span>药箱和不适记录将被删除</span></div><ChevronRight size={17} /></button></Card><Card className="about-card"><ShieldCheck size={19} /><div><strong>隐私与健康声明</strong><p>CareLink 当前将数据保存在你的浏览器中。健康内容只用于日常参考和主动记录，不构成诊断、处方或医疗建议。</p><span>CareLink 0.1.0 · 本地演示版</span></div></Card></> }

function MedicineForm({ initial, onClose, onSave }: { initial: Medicine | null; onClose: () => void; onSave: (m: Medicine) => void }) { const [form, setForm] = useState<Medicine>(initial ?? { id: crypto.randomUUID(), name: '', type: '家庭常备', purpose: '', quantity: 1, unit: '盒', expiry: '', threshold: 2, location: '家庭药箱', note: '' }); const update = (key: keyof Medicine, value: string | number) => setForm(current => ({ ...current, [key]: value })); return <div className="modal-backdrop"><form className="modal" onSubmit={(e: FormEvent) => { e.preventDefault(); if (form.name.trim() && form.expiry) onSave(form) }}><div className="modal-head"><div><span className="eyebrow">家庭药箱</span><h2>{initial ? '编辑药品' : '添加药品'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div><label>药品名称<input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="例如：维生素 C" /></label><div className="form-grid"><label>类型<select value={form.type} onChange={e => update('type', e.target.value)}><option>家庭常备</option><option>护理用品</option><option>营养补充</option><option>处方药</option></select></label><label>用途<input value={form.purpose} onChange={e => update('purpose', e.target.value)} placeholder="主要用途" /></label></div><div className="form-grid"><label>当前数量<input type="number" min="0" value={form.quantity} onChange={e => update('quantity', Number(e.target.value))} /></label><label>单位<select value={form.unit} onChange={e => update('unit', e.target.value)}><option>片</option><option>粒</option><option>盒</option><option>袋</option><option>瓶</option></select></label></div><div className="form-grid"><label>有效期<input required type="date" value={form.expiry} onChange={e => update('expiry', e.target.value)} /></label><label>低库存阈值<input type="number" min="0" value={form.threshold} onChange={e => update('threshold', Number(e.target.value))} /></label></div><label>存放位置<input value={form.location} onChange={e => update('location', e.target.value)} placeholder="例如：家庭药箱" /></label><label>备注<textarea value={form.note} onChange={e => update('note', e.target.value)} placeholder="使用注意事项或其他备注" rows={3} /></label><button className="primary-button full" type="submit"><Check size={17} />保存药品</button></form></div> }

function LogForm({ symptom, onClose, onSave }: { symptom: string; onClose: () => void; onSave: (log: SymptomLog) => void }) { const [form, setForm] = useState({ type: symptom, severity: 3, duration: '1 小时内', note: '', care: '' }); return <div className="modal-backdrop"><form className="modal" onSubmit={e => { e.preventDefault(); onSave({ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }) }}><div className="modal-head"><div><span className="eyebrow">健康记录</span><h2>记录这次不适</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div><label>不适类型<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{symptomInfo.map(s => <option key={s.id}>{s.name}</option>)}</select></label><label>不适程度 <strong className="range-value">{form.severity}/10</strong><input type="range" min="1" max="10" value={form.severity} onChange={e => setForm({ ...form, severity: Number(e.target.value) })} /></label><label>持续时间<select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}><option>1 小时内</option><option>1–3 小时</option><option>半天</option><option>一天以上</option></select></label><label>采取的护理措施<textarea value={form.care} onChange={e => setForm({ ...form, care: e.target.value })} placeholder="例如：热敷、休息、散步" rows={2} /></label><label>个人备注<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="记录当时的感受或可能诱因" rows={2} /></label><button className="primary-button full" type="submit"><Check size={17} />保存记录</button></form></div> }

export default App
