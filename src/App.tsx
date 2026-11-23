import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { CATEGORIES, COUNTRIES, categoryOf, countryOf, formatMoney, type CountryId, type Listing, type Period } from './data'
import { LANGS, pick, translate, type Key, type Lang } from './i18n'
import { DatingScreen, PersonScreen } from './Dating'
import { Icon } from './Icon'
import { BannerCarousel } from './Banners'
import { ageOf, avatarStyle, type Gender, type Goal } from './people'
import * as api from './api'
import type { ChatRow, Message, Person, Profile, Session } from './api'

const PREFS = 'migway.prefs.v1'

interface Prefs {
  lang: Lang
  country: CountryId
  city: string
  onboarded: boolean
}

const INITIAL: Prefs = { lang: 'ru', country: 'ru', city: 'moscow', onboarded: false }

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS)
    if (raw) return { ...INITIAL, ...JSON.parse(raw) }
  } catch {
    /* без localStorage работаем в памяти */
  }
  return INITIAL
}

type Tab = 'home' | 'listings' | 'add' | 'chat' | 'profile'
export type Screen =
  | { type: 'listing'; id: string }
  | { type: 'category'; cat: string }
  | { type: 'chat'; id: string }
  | { type: 'my'; mode: 'mine' | 'favorites' }
  | { type: 'person'; id: string }
  | { type: 'auth' }
  | { type: 'edit'; id: string }
  | { type: 'profileEdit' }
  | { type: 'terms' }
  | { type: 'blocked' }

export type Sheet =
  | { type: 'location' }
  | { type: 'lang' }
  | { type: 'report'; listing?: string; user?: string }
  | null

type Listener = (m: Message) => void

export interface Ctx {
  prefs: Prefs
  me: string | null
  email: string
  profile: Profile | null
  setProfile: (p: Profile) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  country: ReturnType<typeof countryOf>
  all: Listing[]
  local: Listing[]
  loadState: 'loading' | 'ok' | 'error'
  reload: () => void
  updatePrefs: (patch: Partial<Prefs>) => void
  push: (screen: Screen) => void
  pop: () => void
  setTab: (tab: Tab) => void
  setSheet: (sheet: Sheet) => void
  query: string
  setQuery: (q: string) => void
  favorites: string[]
  toggleFavorite: (id: string) => void
  likes: string[]
  toggleLike: (id: string) => void
  blocks: string[]
  setBlock: (id: string, on: boolean) => Promise<void>
  chats: ChatRow[]
  refreshChats: () => void
  upsertListing: (l: Listing) => void
  removeListing: (id: string) => void
  requireAuth: () => boolean
  toast: (text: string) => void
  people: Record<string, Person>
  rememberPeople: (list: Person[]) => void
  onMessage: (fn: Listener) => () => void
  openChat: (target: { listing?: string; person?: string }) => Promise<void>
}

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [feed, setFeed] = useState<Listing[]>([])
  const [extra, setExtra] = useState<Record<string, Listing>>({})
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [favorites, setFavorites] = useState<string[]>([])
  const [likes, setLikes] = useState<string[]>([])
  const [blocks, setBlocks] = useState<string[]>([])
  const [chats, setChats] = useState<ChatRow[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [tab, setTab] = useState<Tab>('home')
  const [stack, setStack] = useState<Screen[]>([])
  const [sheet, setSheet] = useState<Sheet>(null)
  const [query, setQuery] = useState('')
  const [toastText, setToastText] = useState('')
  const listeners = useRef(new Set<Listener>())
  const me = session?.user.id ?? null

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(prefs.lang, key, vars), [prefs.lang])

  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs))
    } catch {
      /* квота или приватный режим */
    }
    document.documentElement.lang = prefs.lang
  }, [prefs])

  const toastTimer = useRef(0)
  const toast = useCallback((text: string) => {
    setToastText(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastText(''), 2600)
  }, [])

  /* ---------- сессия ---------- */
  useEffect(() => {
    api.supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = api.supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshChats = useCallback(() => {
    if (!me) return
    api.fetchChats().then(setChats).catch(() => undefined)
  }, [me])

  // данные пользователя
  useEffect(() => {
    if (!me) {
      setProfile(null)
      setFavorites([])
      setLikes([])
      setBlocks([])
      setChats([])
      setExtra({})
      return
    }
    let alive = true
    api.fetchProfile(me).then((p) => alive && setProfile(p)).catch(() => undefined)
    api.fetchIds('favorites').then(async (ids) => {
      if (!alive) return
      setFavorites(ids)
      const items = await api.fetchListingsByIds(ids, me)
      if (alive) setExtra((prev) => ({ ...prev, ...Object.fromEntries(items.map((l) => [l.id, l])) }))
    }).catch(() => undefined)
    api.fetchIds('likes').then((ids) => alive && setLikes(ids)).catch(() => undefined)
    api.fetchIds('blocks').then((ids) => alive && setBlocks(ids)).catch(() => undefined)
    refreshChats()
    return () => {
      alive = false
    }
  }, [me, refreshChats])

  // «в сети»: отмечаемся при входе и раз в 5 минут
  useEffect(() => {
    if (!me) return
    const touch = () => api.updateProfile(me, { last_seen: new Date().toISOString() }).catch(() => undefined)
    touch()
    const id = window.setInterval(touch, 5 * 60_000)
    return () => window.clearInterval(id)
  }, [me])

  // новые сообщения в реальном времени
  const chatsTimer = useRef(0)
  useEffect(() => {
    if (!me) return
    const channel = api.supabase
      .channel(`inbox-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message
        listeners.current.forEach((fn) => fn(m))
        window.clearTimeout(chatsTimer.current)
        chatsTimer.current = window.setTimeout(refreshChats, 300)
      })
      .subscribe()
    return () => {
      api.supabase.removeChannel(channel)
    }
  }, [me, refreshChats])

  /* ---------- объявления ---------- */
  const loadFeed = useCallback(() => {
    setLoadState((s) => (s === 'ok' ? 'ok' : 'loading'))
    api
      .fetchListings(prefs.country, me)
      .then((items) => {
        setFeed(items)
        setLoadState('ok')
      })
      .catch(() => setLoadState((s) => (s === 'ok' ? 'ok' : 'error')))
  }, [prefs.country, me])

  useEffect(loadFeed, [loadFeed])

  // при возвращении в приложение обновляем ленту и чаты
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = NativeApp.addListener('resume', () => {
      loadFeed()
      refreshChats()
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [loadFeed, refreshChats])

  const all = useMemo(() => {
    const map = new Map<string, Listing>()
    for (const l of Object.values(extra)) map.set(l.id, l)
    for (const l of feed) map.set(l.id, l)
    return [...map.values()].filter((l) => l.mine || !blocks.includes(l.owner))
  }, [feed, extra, blocks])
  const visible = all.filter((l) => l.status === 'active')
  const local = visible.filter((l) => l.country === prefs.country && l.city === prefs.city)

  const push = useCallback((screen: Screen) => setStack((prev) => [...prev, screen]), [])
  const pop = useCallback(() => setStack((prev) => prev.slice(0, -1)), [])

  const requireAuth = () => {
    if (me) return true
    push({ type: 'auth' })
    return false
  }

  const ctx: Ctx = {
    prefs,
    me,
    email: session?.user.email ?? '',
    profile,
    setProfile,
    t,
    country: countryOf(prefs.country),
    all,
    local,
    loadState,
    reload: loadFeed,
    updatePrefs: (patch) => setPrefs((prev) => ({ ...prev, ...patch })),
    push,
    pop,
    setTab: (next) => {
      setStack([])
      setTab(next)
    },
    setSheet,
    query,
    setQuery,
    favorites,
    toggleFavorite: (id) => {
      if (!requireAuth()) return
      const on = !favorites.includes(id)
      setFavorites((prev) => (on ? [...prev, id] : prev.filter((f) => f !== id)))
      api.setFavorite(id, on).catch(() => {
        setFavorites((prev) => (on ? prev.filter((f) => f !== id) : [...prev, id]))
        toast(t('netError'))
      })
    },
    likes,
    toggleLike: (id) => {
      if (!requireAuth()) return
      const on = !likes.includes(id)
      setLikes((prev) => (on ? [...prev, id] : prev.filter((f) => f !== id)))
      api.setLike(id, on).catch(() => {
        setLikes((prev) => (on ? prev.filter((f) => f !== id) : [...prev, id]))
        toast(t('netError'))
      })
    },
    blocks,
    setBlock: async (id, on) => {
      await api.setBlocked(id, on)
      setBlocks((prev) => (on ? [...prev, id] : prev.filter((b) => b !== id)))
      refreshChats()
    },
    chats,
    refreshChats,
    upsertListing: (l) => {
      setExtra((prev) => ({ ...prev, [l.id]: l }))
      setFeed((prev) => (prev.some((x) => x.id === l.id) ? prev.map((x) => (x.id === l.id ? l : x)) : prev))
    },
    removeListing: (id) => {
      setExtra((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setFeed((prev) => prev.filter((l) => l.id !== id))
    },
    requireAuth,
    toast,
    people,
    rememberPeople: (list) => setPeople((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) })),
    onMessage: (fn) => {
      listeners.current.add(fn)
      return () => listeners.current.delete(fn)
    },
    openChat: async (target) => {
      if (!requireAuth()) return
      try {
        const id = await api.startChat(target)
        refreshChats()
        push({ type: 'chat', id })
      } catch {
        toast(t('netError'))
      }
    },
  }

  const unread = chats.filter((c) => c.unread > 0 && !c.blocked).length

  if (!authReady) return <Device><Splash /></Device>
  if (!prefs.onboarded) return <Device><Onboarding ctx={ctx} /></Device>

  const top = stack[stack.length - 1]
  return (
    <Device>
      <div className="screen__body" key={tab}>
        {tab === 'home' && <Home ctx={ctx} />}
        {tab === 'listings' && <Feed ctx={ctx} />}
        {tab === 'add' && (me ? <PostForm ctx={ctx} /> : <AuthGate ctx={ctx} title={t('postTitle')} />)}
        {tab === 'chat' && (me ? <ChatList ctx={ctx} /> : <AuthGate ctx={ctx} title={t('chats')} />)}
        {tab === 'profile' && <ProfileTab ctx={ctx} />}
      </div>
      <nav className="tabbar">
        {(
          [
            ['home', 'home', 'tabHome'],
            ['listings', 'search', 'search'],
            ['add', 'plus', 'tabAdd'],
            ['chat', 'chat', 'tabChat'],
            ['profile', 'user', 'tabProfile'],
          ] as [Tab, string, Key][]
        ).map(([id, icon, label]) => (
          <button
            key={id}
            className={`tabbar__item${tab === id ? ' on' : ''}${id === 'add' ? ' tabbar__item--add' : ''}`}
            onClick={() => {
              setStack([])
              setTab(id)
              if (id === 'home' || id === 'listings') loadFeed()
              if (id === 'chat') refreshChats()
            }}
          >
            {id === 'add' ? <span className="tabbar__plus"><Icon name="plus" size={18} /></span> : <Icon name={icon} />}
            <span>{t(label)}</span>
            {id === 'chat' && unread > 0 && <b className="badge-count">{unread}</b>}
          </button>
        ))}
      </nav>
      {stack.map((screen, index) => (
        <div className={`layer${screen === top ? ' layer--top' : ''}`} key={index}>
          {screen.type === 'listing' && <ListingScreen ctx={ctx} id={screen.id} />}
          {screen.type === 'category' && (screen.cat === 'people' ? <DatingScreen ctx={ctx} /> : <Feed ctx={ctx} cat={screen.cat} />)}
          {screen.type === 'person' && <PersonScreen ctx={ctx} id={screen.id} />}
          {screen.type === 'chat' && <ChatRoom ctx={ctx} id={screen.id} />}
          {screen.type === 'my' && <MyListings ctx={ctx} mode={screen.mode} />}
          {screen.type === 'auth' && <AuthScreen ctx={ctx} />}
          {screen.type === 'edit' && <EditListing ctx={ctx} id={screen.id} />}
          {screen.type === 'profileEdit' && <ProfileEdit ctx={ctx} />}
          {screen.type === 'terms' && <Terms ctx={ctx} />}
          {screen.type === 'blocked' && <BlockedList ctx={ctx} />}
        </div>
      ))}
      {sheet?.type === 'location' && <LocationSheet ctx={ctx} />}
      {sheet?.type === 'lang' && <LangSheet ctx={ctx} />}
      {sheet?.type === 'report' && <ReportSheet ctx={ctx} listing={sheet.listing} user={sheet.user} />}
      {toastText && <div className="toast" role="status">{toastText}</div>}
    </Device>
  )
}

function Device({ children }: { children: ReactNode }) {
  return (
    <div className="device">
      <div className="screen">{children}</div>
    </div>
  )
}

function Splash() {
  return (
    <div className="screen__body onboarding splash">
      <div className="logo-big">
        <span className="logo-mark">M</span>
        <b>MigWay</b>
      </div>
    </div>
  )
}

/* ---------- helpers ---------- */

export function cityName(ctx: Ctx, countryId: CountryId, cityId: string) {
  const city = countryOf(countryId).cities.find((c) => c.id === cityId)
  return city ? pick(ctx.prefs.lang, city.name) : cityId
}

export const PERIOD_KEY: Record<Period, Key> = { month: 'pMonth', day: 'pDay', hour: 'pHour', week: 'pWeek', kg: 'pKg' }

function PriceText({ ctx, price, period, country, big }: { ctx: Ctx; price: number | null; period?: Period | null; country: CountryId; big?: boolean }) {
  if (price === null) return <span className={big ? 'price price--big' : 'price'}>{ctx.t('free')}</span>
  return (
    <span className={big ? 'price price--big' : 'price'}>
      {formatMoney(price, countryOf(country).currency)}
      {period && <small> {ctx.t(PERIOD_KEY[period])}</small>}
    </span>
  )
}

function Price({ ctx, listing, big }: { ctx: Ctx; listing: Listing; big?: boolean }) {
  return <PriceText ctx={ctx} price={listing.price} period={listing.period} country={listing.country} big={big} />
}

function agoMs(ctx: Ctx, created: number) {
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60_000))
  if (minutes < 1) return ctx.t('justNow')
  if (minutes < 60) return ctx.t('minAgo', { n: minutes })
  if (minutes < 60 * 24) return ctx.t('hAgo', { n: Math.round(minutes / 60) })
  return ctx.t('dAgo', { n: Math.round(minutes / 1440) })
}

function Cover({ listing, large }: { listing: Listing; large?: boolean }) {
  const cat = categoryOf(listing.cat)
  if (listing.photo) return <img className="cover" src={listing.photo} alt="" loading="lazy" />
  return (
    <div className={`cover cover--art${large ? ' cover--large' : ''}`} style={{ background: `linear-gradient(150deg, #ffffffb0, transparent 70%), ${cat.color}` }}>
      <Icon name={cat.icon} size={large ? 72 : 40} stroke={1.3} />
    </div>
  )
}

function FavButton({ ctx, id, large }: { ctx: Ctx; id: string; large?: boolean }) {
  const on = ctx.favorites.includes(id)
  return (
    <button
      className={`fav${on ? ' fav--on' : ''}${large ? ' fav--large' : ''}`}
      aria-label={ctx.t('favorites')}
      onClick={(e) => {
        e.stopPropagation()
        ctx.toggleFavorite(id)
      }}
    >
      <Icon name="heart" size={large ? 20 : 14} filled={on} />
    </button>
  )
}

function Card({ ctx, listing }: { ctx: Ctx; listing: Listing }) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={() => ctx.push({ type: 'listing', id: listing.id })} onKeyDown={(e) => e.key === 'Enter' && ctx.push({ type: 'listing', id: listing.id })}>
      <div className="card__media">
        <Cover listing={listing} />
        {listing.premium && <span className="tag-premium">{ctx.t('premium')}</span>}
        {listing.status === 'hidden' && <span className="tag-premium tag-hidden">{ctx.t('hiddenTag')}</span>}
        {!listing.mine && <FavButton ctx={ctx} id={listing.id} />}
      </div>
      <Price ctx={ctx} listing={listing} />
      <span className="card__title">{listing.title}</span>
      <span className="card__meta">
        {cityName(ctx, listing.country, listing.city)} • {agoMs(ctx, listing.createdAt)}
      </span>
    </div>
  )
}

export function Grid({ ctx, items, empty }: { ctx: Ctx; items: Listing[]; empty?: ReactNode }) {
  if (items.length === 0)
    return (
      empty ?? (
        <div className="empty">
          <span>🌱</span>
          <b>{ctx.t('nothing')}</b>
          <small>{ctx.t('nothingHint')}</small>
        </div>
      )
    )
  return (
    <div className="grid">
      {items.map((l) => (
        <Card key={l.id} ctx={ctx} listing={l} />
      ))}
    </div>
  )
}

export function TopBar({ ctx, title, right }: { ctx: Ctx; title: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      <button className="round-btn" onClick={ctx.pop} aria-label="Назад">
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
      <span className="topbar__right">{right}</span>
    </header>
  )
}

function sortListings(items: Listing[]) {
  return [...items].sort((a, b) => Number(Boolean(b.premium)) - Number(Boolean(a.premium)) || b.createdAt - a.createdAt)
}

/* ---------- onboarding ---------- */

function Onboarding({ ctx }: { ctx: Ctx }) {
  const { prefs, t, updatePrefs } = ctx
  return (
    <div className="screen__body onboarding">
      <div className="logo-big">
        <span className="logo-mark">M</span>
        <b>{t('brand')}</b>
        <small>{t('appTagline')}</small>
      </div>
      <h2>{t('chooseLang')}</h2>
      <div className="pick-grid">
        {LANGS.map((l) => (
          <button key={l.id} className={`pick${prefs.lang === l.id ? ' on' : ''}`} onClick={() => updatePrefs({ lang: l.id })}>
            <span>{l.flag}</span>
            {l.name}
          </button>
        ))}
      </div>
      <h2>{t('chooseCountry')}</h2>
      <div className="pick-grid pick-grid--3">
        {COUNTRIES.map((c) => (
          <button key={c.id} className={`pick pick--col${prefs.country === c.id ? ' on' : ''}`} onClick={() => updatePrefs({ country: c.id, city: c.cities[0].id })}>
            <span className="pick__flag">{c.flag}</span>
            {pick(prefs.lang, c.name)}
          </button>
        ))}
      </div>
      <h2>{t('chooseCity')}</h2>
      <div className="chips chips--wrap">
        {ctx.country.cities.map((c) => (
          <button key={c.id} className={`chip${prefs.city === c.id ? ' on' : ''}`} onClick={() => updatePrefs({ city: c.id })}>
            {pick(prefs.lang, c.name)}
          </button>
        ))}
      </div>
      <button className="btn btn--primary btn--block onboarding__go" onClick={() => updatePrefs({ onboarded: true })}>
        {t('start')}
      </button>
    </div>
  )
}

/* ---------- auth ---------- */

function AuthGate({ ctx, title }: { ctx: Ctx; title: string }) {
  return (
    <>
      <header className="feed-head">
        <h1>{title}</h1>
      </header>
      <div className="pad">
        <div className="empty">
          <span>🔐</span>
          <small>{ctx.t('authWhy')}</small>
          <button className="btn btn--primary" onClick={() => ctx.push({ type: 'auth' })}>
            {ctx.t('signIn')}
          </button>
        </div>
      </div>
    </>
  )
}

function AuthScreen({ ctx }: { ctx: Ctx }) {
  const { t } = ctx
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (ctx.me) ctx.pop()
  }, [ctx.me])

  async function submit() {
    setError('')
    setInfo('')
    const mail = email.trim().toLowerCase()
    if (!mail || password.length < 6 || (mode === 'up' && (!name.trim() || !gender))) {
      setError(password && password.length < 6 ? t('passwordHint') : t('fillAll'))
      return
    }
    if (mode === 'up' && !agree) {
      setError(t('mustAgree'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await api.supabase.auth.signInWithPassword({ email: mail, password })
        if (error) setError(error.message.includes('confirm') ? t('checkEmail', { e: mail }) : t('authError'))
      } else {
        const { data, error } = await api.supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { name: name.trim(), gender, country: ctx.prefs.country, city: ctx.prefs.city } },
        })
        if (error) setError(/registered|exists/i.test(error.message) ? t('emailTaken') : error.message)
        else if (!data.session) setInfo(t('checkEmail', { e: mail }))
        else if (data.user && data.user.identities?.length === 0) setError(t('emailTaken'))
      }
    } catch {
      setError(t('netError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar ctx={ctx} title={mode === 'in' ? t('signIn') : t('signUp')} />
      <div className="pad form auth">
        <div className="logo-big logo-big--sm">
          <span className="logo-mark">M</span>
          <small>{t('authWhy')}</small>
        </div>
        {mode === 'up' && (
          <>
            <label className="field">
              <span>{t('yourName')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePh')} maxLength={40} autoComplete="name" />
            </label>
            <div className="field">
              <span>{t('yourGender')}</span>
              <div className="pick-grid">
                {(['m', 'f'] as Gender[]).map((g) => (
                  <button key={g} className={`pick${gender === g ? ' on' : ''}`} onClick={() => setGender(g)}>
                    <span>{g === 'm' ? '👨' : '👩'}</span>
                    {t(g === 'm' ? 'male' : 'female')}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <label className="field">
          <span>{t('email')}</span>
          <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('password')}</span>
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordHint')}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {mode === 'up' && (
          <label className="switch">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              {t('agreeTerms')}{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  ctx.push({ type: 'terms' })
                }}
              >
                {t('terms')}
              </a>
            </span>
          </label>
        )}
        {error && <div className="error">{error}</div>}
        {info && <div className="notice">{info}</div>}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={submit}>
          {busy ? t('loading') : mode === 'in' ? t('signIn') : t('createAccount')}
        </button>
        <button
          className="btn btn--soft btn--block"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError('')
            setInfo('')
          }}
        >
          {mode === 'in' ? t('noAccount') : t('haveAccount')}
        </button>
      </div>
    </>
  )
}

function Terms({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <TopBar ctx={ctx} title={ctx.t('terms')} />
      <div className="pad">
        <p className="detail__desc terms-text">{ctx.t('termsText')}</p>
      </div>
    </>
  )
}

/* ---------- home ---------- */

function LoadError({ ctx }: { ctx: Ctx }) {
  return (
    <div className="empty">
      <span>📡</span>
      <small>{ctx.t('netError')}</small>
      <button className="btn btn--soft" onClick={ctx.reload}>
        {ctx.t('retry')}
      </button>
    </div>
  )
}

function Home({ ctx }: { ctx: Ctx }) {
  const { prefs, t, local } = ctx
  const fresh = [...local].sort((a, b) => b.createdAt - a.createdAt)
  const premium = sortListings(local).filter((l) => l.premium)
  const nearby = ctx.all.filter((l) => l.status === 'active' && l.country === prefs.country && l.city !== prefs.city).sort((a, b) => b.createdAt - a.createdAt)
  return (
    <>
      <header className="home-head">
        <span className="logo">{t('brand')}</span>
        <button className="loc" onClick={() => ctx.setSheet({ type: 'location' })}>
          <Icon name="nav" size={16} />
          {cityName(ctx, prefs.country, prefs.city)}
        </button>
        <button className="round-btn round-btn--plain" onClick={() => ctx.requireAuth() && ctx.push({ type: 'my', mode: 'favorites' })} aria-label={t('favorites')}>
          <Icon name="heart" size={22} />
        </button>
        <button className="round-btn round-btn--plain" onClick={() => ctx.setTab('chat')} aria-label={t('chats')}>
          <Icon name="bell" size={22} />
        </button>
      </header>
      <div className="pad">
        <button className="searchbar" onClick={() => ctx.setTab('listings')}>
          <Icon name="search" size={18} />
          <span>{t('search')}</span>
        </button>
        <BannerCarousel ctx={ctx} />
      </div>
      <div className="chips chips--cats">
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip chip--icon" onClick={() => ctx.push({ type: 'category', cat: c.id })}>
            <Icon name={c.icon} size={18} />
            {pick(prefs.lang, c.name)}
          </button>
        ))}
      </div>
      {ctx.loadState === 'loading' && <p className="muted small pad">{t('loading')}</p>}
      {ctx.loadState === 'error' && <div className="pad"><LoadError ctx={ctx} /></div>}
      <Shelf ctx={ctx} title={t('latest')} items={fresh.slice(0, 10)} onMore={() => ctx.setTab('listings')} />
      <Shelf ctx={ctx} title={t('recommended')} items={premium} onMore={() => ctx.setTab('listings')} />
      {CATEGORIES.slice(0, 2).map((c) => (
        <Shelf
          key={c.id}
          ctx={ctx}
          title={pick(prefs.lang, c.name)}
          items={fresh.filter((l) => l.cat === c.id)}
          onMore={() => ctx.push({ type: 'category', cat: c.id })}
        />
      ))}
      <Shelf ctx={ctx} title={t('nearby')} items={nearby.slice(0, 10)} onMore={() => ctx.setSheet({ type: 'location' })} />
      {ctx.loadState === 'ok' && local.length === 0 && (
        <div className="pad">
          <div className="empty">
            <span>🌱</span>
            <small>{t('noListingsCity')}</small>
            <button className="btn btn--primary" onClick={() => ctx.setTab('add')}>
              {t('postFirst')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Shelf({ ctx, title, items, onMore }: { ctx: Ctx; title: string; items: Listing[]; onMore: () => void }) {
  if (items.length === 0) return null
  return (
    <section>
      <button className="section-title pad" onClick={onMore}>
        {title} <Icon name="chevron" size={18} />
      </button>
      <div className="shelf">
        {items.map((l) => (
          <Card key={l.id} ctx={ctx} listing={l} />
        ))}
      </div>
    </section>
  )
}

/* ---------- feed / category ---------- */

type Sort = 'new' | 'cheap' | 'expensive'

function Feed({ ctx, cat }: { ctx: Ctx; cat?: string }) {
  const { prefs, t } = ctx
  const [activeCat, setActiveCat] = useState(cat ?? '')
  const [sub, setSub] = useState('')
  const [sort, setSort] = useState<Sort>('new')
  const [photoOnly, setPhotoOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const category = activeCat ? categoryOf(activeCat) : null
  const q = ctx.query.trim().toLowerCase()

  let items = ctx.local.filter((l) => (!activeCat || l.cat === activeCat) && (!sub || l.sub === sub))
  if (q) items = items.filter((l) => `${l.title} ${l.desc} ${l.author}`.toLowerCase().includes(q))
  if (photoOnly) items = items.filter((l) => l.photos.length > 0)
  items =
    sort === 'new'
      ? sortListings(items)
      : [...items].sort((a, b) => {
          // «Договорная» всегда в конце списка
          if (a.price === null || b.price === null) return Number(a.price === null) - Number(b.price === null)
          return (a.price - b.price) * (sort === 'cheap' ? 1 : -1)
        })

  return (
    <>
      {cat ? (
        <TopBar ctx={ctx} title={category ? pick(prefs.lang, category.name) : ''} />
      ) : (
        <header className="feed-head">
          <h1>{t('tabListings')}</h1>
        </header>
      )}
      <div className="pad">
        <div className="searchbar searchbar--input">
          <Icon name="search" size={20} />
          <input type="search" value={ctx.query} onChange={(e) => ctx.setQuery(e.target.value)} placeholder={t('searchHint')} enterKeyHint="search" />
          <button className={`icon-only${showFilters ? ' on' : ''}`} onClick={() => setShowFilters(!showFilters)} aria-label={t('filters')}>
            <Icon name="sliders" size={20} />
          </button>
        </div>
        {showFilters && (
          <div className="filters">
            {(['new', 'cheap', 'expensive'] as Sort[]).map((s) => (
              <button key={s} className={`chip${sort === s ? ' on' : ''}`} onClick={() => setSort(s)}>
                {t(s === 'new' ? 'sortNew' : s === 'cheap' ? 'sortCheap' : 'sortExpensive')}
              </button>
            ))}
            <button className={`chip${photoOnly ? ' on' : ''}`} onClick={() => setPhotoOnly(!photoOnly)}>
              📷 {t('onlyPhoto')}
            </button>
          </div>
        )}
      </div>
      <div className="chips">
        {!cat && (
          <>
            <button className={`chip${!activeCat ? ' on' : ''}`} onClick={() => { setActiveCat(''); setSub('') }}>
              {t('all')}
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`chip chip--icon${activeCat === c.id ? ' on' : ''}`} onClick={() => { setActiveCat(c.id); setSub('') }}>
                <Icon name={c.icon} size={16} /> {pick(prefs.lang, c.name)}
              </button>
            ))}
          </>
        )}
        {cat && category && (
          <>
            <button className={`chip${!sub ? ' on' : ''}`} onClick={() => setSub('')}>
              {t('all')}
            </button>
            {category.subs.map((s) => (
              <button key={s.id} className={`chip${sub === s.id ? ' on' : ''}`} onClick={() => setSub(s.id)}>
                {pick(prefs.lang, s.name)}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="pad">
        <p className="muted small">
          {cityName(ctx, prefs.country, prefs.city)} · {items.length} {t('results')}
        </p>
        {ctx.loadState === 'error' ? <LoadError ctx={ctx} /> : <Grid ctx={ctx} items={items} />}
      </div>
    </>
  )
}

/* ---------- listing ---------- */

function ListingScreen({ ctx, id }: { ctx: Ctx; id: string }) {
  const { prefs, t } = ctx
  const found = ctx.all.find((l) => l.id === id)
  const [missing, setMissing] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (found) return
    api
      .fetchListingsByIds([id], ctx.me)
      .then((items) => (items[0] ? ctx.upsertListing(items[0]) : setMissing(true)))
      .catch(() => setMissing(true))
  }, [id])

  useEffect(() => {
    if (found && !found.mine) api.markViewed(id).catch(() => undefined)
  }, [Boolean(found)])

  if (!found) return <TopBar ctx={ctx} title={missing ? t('listingGone') : t('loading')} />
  const listing = found
  const cat = categoryOf(listing.cat)
  const sub = cat.subs.find((s) => s.id === listing.sub)
  const similar = ctx.all.filter((l) => l.id !== listing.id && l.status === 'active' && l.country === listing.country && l.cat === listing.cat).slice(0, 8)
  const phone = listing.phone.replace(/[^\d+]/g, '')

  async function setStatus(status: 'active' | 'hidden') {
    if (!ctx.me) return
    setBusy(true)
    try {
      ctx.upsertListing(await api.updateListing(listing.id, { status }, ctx.me))
    } catch {
      ctx.toast(t('netError'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    try {
      await api.deleteListing(listing.id)
      ctx.removeListing(listing.id)
      ctx.pop()
    } catch {
      ctx.toast(t('netError'))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scroll">
        <div className="hero">
          {listing.photos.length > 1 ? (
            <div className="gallery">
              {listing.photos.map((src) => (
                <img key={src} className="cover" src={src} alt="" />
              ))}
            </div>
          ) : (
            <Cover listing={listing} large />
          )}
          {listing.photos.length > 1 && <span className="gallery__count">📷 {listing.photos.length}</span>}
          <button className="round-btn round-btn--glass hero__back" onClick={ctx.pop} aria-label="Назад">
            <Icon name="back" />
          </button>
          <div className="hero__right">
            <button
              className="round-btn round-btn--glass"
              aria-label="Поделиться"
              onClick={() => navigator.share?.({ title: listing.title, text: `${listing.title}\n${t('sharedText')}` }).catch(() => undefined)}
            >
              <Icon name="share" size={20} />
            </button>
            {!listing.mine && <FavButton ctx={ctx} id={listing.id} large />}
          </div>
        </div>
        <div className="pad detail">
          <div className="author">
            <span className="avatar" style={listing.authorAvatar ? avatarStyle({ id: listing.owner, avatar_url: listing.authorAvatar }) : undefined}>
              {listing.authorAvatar ? '' : listing.author.slice(0, 1)}
            </span>
            <span>
              <b>{listing.author}</b>
              <small>{t('onMigrant', { y: listing.since })}</small>
            </span>
          </div>
          {listing.premium && <span className="tag-premium tag-premium--inline">{t('premium')}</span>}
          {listing.status === 'hidden' && <span className="tag-premium tag-premium--inline tag-hidden">{t('hiddenTag')}</span>}
          <Price ctx={ctx} listing={listing} big />
          <h1 className="detail__title">{listing.title}</h1>
          <div className="detail__meta">
            <span>
              <Icon name="pin" size={16} /> {cityName(ctx, listing.country, listing.city)}
            </span>
            <span>
              <Icon name="clock" size={16} /> {agoMs(ctx, listing.createdAt)}
            </span>
            <span>
              <Icon name="eye" size={16} /> {listing.views}
            </span>
          </div>
          {listing.desc && (
            <>
              <h2 className="detail__h">{t('description')}</h2>
              <p className="detail__desc">{listing.desc}</p>
            </>
          )}
          <h2 className="detail__h">{t('details')}</h2>
          <dl className="props">
            <div>
              <dt>{t('category')}:</dt>
              <dd>
                {pick(prefs.lang, cat.name)}
                {sub ? ` · ${pick(prefs.lang, sub.name)}` : ''}
              </dd>
            </div>
          </dl>
          <div className="safety">{t('safety')}</div>
          {!listing.mine && (
            <div className="linkrow">
              <button onClick={() => ctx.requireAuth() && ctx.setSheet({ type: 'report', listing: listing.id, user: listing.owner })}>⚠️ {t('report')}</button>
              <BlockButton ctx={ctx} userId={listing.owner} after={ctx.pop} />
            </div>
          )}
        </div>
        <Shelf ctx={ctx} title={t('similar')} items={similar} onMore={() => ctx.push({ type: 'category', cat: listing.cat })} />
        <div className="detail-gap" />
      </div>
      {listing.mine ? (
        <div className="actionbar actionbar--owner">
          <button className="btn btn--soft" disabled={busy} onClick={() => ctx.push({ type: 'edit', id: listing.id })}>
            {t('edit')}
          </button>
          <button className="btn btn--soft" disabled={busy} onClick={() => setStatus(listing.status === 'active' ? 'hidden' : 'active')}>
            {listing.status === 'active' ? t('hide') : t('republish')}
          </button>
          <button className={`btn btn--danger${confirmDelete ? ' btn--confirm' : ''}`} disabled={busy} onClick={remove} aria-label={t('delete')}>
            {confirmDelete ? t('confirmDelete') : <Icon name="trash" size={18} />}
          </button>
        </div>
      ) : (
        <div className="actionbar">
          {phone.length > 4 &&
            (showPhone ? (
              <a className="btn btn--soft" href={`tel:${phone}`}>
                <Icon name="phone" size={18} /> {listing.phone}
              </a>
            ) : (
              <button className="btn btn--soft" onClick={() => setShowPhone(true)}>
                <Icon name="phone" size={18} /> {t('call')}
              </button>
            ))}
          {listing.whatsapp && phone.length > 4 && (
            <a className="btn btn--wa" href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <Icon name="wa" size={20} />
            </a>
          )}
          <button className="btn btn--primary" onClick={() => ctx.openChat({ listing: listing.id })}>
            <Icon name="chat" size={18} /> {t('write')}
          </button>
        </div>
      )}
    </>
  )
}

export function BlockButton({ ctx, userId, after }: { ctx: Ctx; userId: string; after?: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const blocked = ctx.blocks.includes(userId)
  return (
    <button
      onClick={async () => {
        if (!ctx.requireAuth()) return
        if (!blocked && !confirm) {
          setConfirm(true)
          return
        }
        try {
          await ctx.setBlock(userId, !blocked)
          setConfirm(false)
          if (!blocked) after?.()
        } catch {
          ctx.toast(ctx.t('netError'))
        }
      }}
    >
      🚫 {blocked ? ctx.t('unblock') : confirm ? ctx.t('blockConfirm') : ctx.t('block')}
    </button>
  )
}

/* ---------- chats ---------- */

export function PersonAvatar({ p, size = 48 }: { p: { id: string; name: string; gender?: Gender | null; avatar_url?: string | null; online?: boolean }; size?: number }) {
  return (
    <span className="pavatar" style={{ ...avatarStyle(p), width: size, height: size, fontSize: size * 0.42 }}>
      {p.avatar_url ? '' : p.name.slice(0, 1)}
      {p.online && <i />}
    </span>
  )
}

function ChatImage({ row }: { row: ChatRow }) {
  if (row.kind === 'listing') {
    if (row.listing_photo) return <img className="cover" src={row.listing_photo} alt="" />
    return <span className="pcover pcover--fill" style={avatarStyle({ id: row.peer_id })}>{row.peer_name.slice(0, 1)}</span>
  }
  return (
    <span className="pcover pcover--fill" style={avatarStyle({ id: row.peer_id, gender: row.peer_gender, avatar_url: row.peer_avatar })}>
      {row.peer_avatar ? '' : row.peer_name.slice(0, 1)}
    </span>
  )
}

function chatSubtitle(ctx: Ctx, row: ChatRow) {
  if (row.kind === 'listing') return row.listing_title ?? ctx.t('listingGone')
  const age = ageOf(row.peer_birth_year)
  return age ? `${ctx.t('chatPerson')} · ${ctx.t('years', { n: age })}` : ctx.t('chatPerson')
}

function ChatList({ ctx }: { ctx: Ctx }) {
  const { t } = ctx
  const rows = ctx.chats.filter((c) => c.last_at)
  return (
    <>
      <header className="feed-head">
        <h1>{t('chats')}</h1>
      </header>
      {rows.length === 0 && (
        <div className="pad">
          <div className="empty">
            <span>💬</span>
            <small>{t('noChats')}</small>
          </div>
        </div>
      )}
      <div className="chatlist">
        {rows.map((row) => (
          <button key={row.id} className="chatrow" onClick={() => ctx.push({ type: 'chat', id: row.id })}>
            <span className="chatrow__img"><ChatImage row={row} /></span>
            <span className="chatrow__body">
              <b>{row.peer_name}</b>
              <small>{chatSubtitle(ctx, row)}</small>
              <span>{row.last_body ? `${row.last_sender === ctx.me ? `${t('you')}: ` : ''}${row.last_body}` : '…'}</span>
            </span>
            {row.unread > 0 && !row.blocked && <i className="dot" />}
          </button>
        ))}
      </div>
    </>
  )
}

function ChatRoom({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = ctx
  const row = ctx.chats.find((c) => c.id === id)
  const [msgs, setMsgs] = useState<Message[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const prefilled = useRef(false)

  useEffect(() => {
    let alive = true
    api
      .fetchMessages(id)
      .then((list) => {
        if (!alive) return
        setMsgs((prev) => merge(prev ?? [], list))
        if (ctx.me) api.markRead(id, ctx.me).then(ctx.refreshChats)
      })
      .catch(() => alive && setMsgs([]))
    const off = ctx.onMessage((m) => {
      if (m.chat_id !== id) return
      setMsgs((prev) => merge(prev ?? [], [m]))
      if (ctx.me && m.sender !== ctx.me) api.markRead(id, ctx.me).then(ctx.refreshChats)
    })
    return () => {
      alive = false
      off()
    }
  }, [id])

  useEffect(() => {
    if (msgs && msgs.length === 0 && !prefilled.current && row) {
      prefilled.current = true
      setText(t(row.kind === 'person' ? 'hiPerson' : 'helloText'))
    }
  }, [msgs, row])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs?.length])

  if (!row) return <TopBar ctx={ctx} title={t('loading')} />

  const open = () => (row.kind === 'listing' ? row.listing_id && ctx.push({ type: 'listing', id: row.listing_id }) : ctx.push({ type: 'person', id: row.peer_id }))

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const m = await api.sendMessage(id, body)
      setMsgs((prev) => merge(prev ?? [], [m]))
      setText('')
      ctx.refreshChats()
    } catch {
      ctx.toast(t('sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <TopBar ctx={ctx} title={row.peer_name} />
      <button className="chat-listing" onClick={open}>
        <span className="chatrow__img chatrow__img--sm"><ChatImage row={row} /></span>
        <span>
          <b>{chatSubtitle(ctx, row)}</b>
          {row.kind === 'listing' && row.listing_country && (
            <PriceText ctx={ctx} price={row.listing_price === null ? null : Number(row.listing_price)} period={row.listing_period} country={row.listing_country} />
          )}
        </span>
      </button>
      <div className="messages">
        {msgs === null && <p className="muted small">{t('loading')}</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={`bubble${m.sender === ctx.me ? ' bubble--me' : ''}`}>
            {m.body}
            <time>{new Date(m.created_at).toLocaleTimeString(ctx.prefs.lang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {row.blocked ? (
        <div className="composer composer--blocked">{t('blockedNote')}</div>
      ) : (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('messageHint')} aria-label={t('messageHint')} maxLength={2000} />
          <button className="send" aria-label="Отправить" disabled={sending || !text.trim()}>
            <Icon name="send" size={20} />
          </button>
        </form>
      )}
    </>
  )
}

function merge(prev: Message[], add: Message[]) {
  const map = new Map(prev.map((m) => [m.id, m]))
  for (const m of add) map.set(m.id, m)
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
}

/* ---------- post / edit ---------- */

function EditListing({ ctx, id }: { ctx: Ctx; id: string }) {
  const listing = ctx.all.find((l) => l.id === id)
  if (!listing) return <TopBar ctx={ctx} title={ctx.t('listingGone')} />
  return <PostForm ctx={ctx} editing={listing} />
}

function PostForm({ ctx, editing }: { ctx: Ctx; editing?: Listing }) {
  const { prefs, t } = ctx
  const countryId = editing?.country ?? prefs.country
  const cityId = editing?.city ?? prefs.city
  const country = countryOf(countryId)
  const [cat, setCat] = useState(editing?.cat ?? '')
  const [sub, setSub] = useState(editing?.sub ?? '')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [desc, setDesc] = useState(editing?.desc ?? '')
  const [price, setPrice] = useState(editing?.price != null ? String(editing.price) : '')
  const [period, setPeriod] = useState<Period | ''>(editing?.period ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? (ctx.profile?.phone || country.phonePrefix + ' '))
  const [whatsapp, setWhatsapp] = useState(editing?.whatsapp ?? true)
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? [])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const category = cat ? categoryOf(cat) : null

  // телефон из профиля может загрузиться позже формы
  useEffect(() => {
    if (!editing && ctx.profile?.phone && phone.trim() === country.phonePrefix) setPhone(ctx.profile.phone)
  }, [ctx.profile?.phone])

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, 6 - photos.length)
    e.target.value = ''
    if (!ctx.me || files.length === 0) return
    setUploading((n) => n + files.length)
    for (const file of files) {
      try {
        const blob = await shrink(file, 1280)
        const url = await api.uploadPhoto(ctx.me, blob)
        setPhotos((prev) => (prev.length < 6 ? [...prev, url] : prev))
      } catch {
        ctx.toast(t('netError'))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function submit() {
    if (!ctx.me || busy) return
    if (!cat || !sub) {
      setError(t('required'))
      return
    }
    if (title.trim().length < 3) {
      setError(t('titleShort'))
      return
    }
    const digits = price.replace(/\D/g, '')
    const cleanPhone = phone.trim().length > country.phonePrefix.length + 1 ? phone.trim() : ''
    const input: api.ListingInput = {
      country: countryId,
      city: cityId,
      cat,
      sub,
      title: title.trim(),
      description: desc.trim(),
      price: digits ? Number(digits) : null,
      period: period || null,
      phone: cleanPhone,
      whatsapp: whatsapp && Boolean(cleanPhone),
      photos,
    }
    setBusy(true)
    setError('')
    try {
      const saved = editing ? await api.updateListing(editing.id, input, ctx.me) : await api.createListing(input, ctx.me)
      ctx.upsertListing(saved)
      if (cleanPhone && ctx.profile && !ctx.profile.phone) {
        api.updateProfile(ctx.me, { phone: cleanPhone }).then(ctx.setProfile).catch(() => undefined)
      }
      if (editing) {
        ctx.pop()
      } else {
        ctx.setTab('home')
        ctx.push({ type: 'listing', id: saved.id })
      }
    } catch {
      setError(t('netError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {editing ? (
        <TopBar ctx={ctx} title={t('editTitle')} />
      ) : (
        <header className="feed-head">
          <h1>{t('postTitle')}</h1>
          <button className="muted small linklike" onClick={() => ctx.setSheet({ type: 'location' })}>
            {country.flag} {cityName(ctx, countryId, cityId)}
          </button>
        </header>
      )}
      <div className="pad form">
        <h2 className="form__h">{t('postCategory')}</h2>
        <div className="catpick">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`catpick__item${cat === c.id ? ' on' : ''}`} onClick={() => { setCat(c.id); setSub('') }}>
              <Icon name={c.icon} size={20} />
              {pick(prefs.lang, c.name)}
            </button>
          ))}
        </div>
        {category && (
          <>
            <h2 className="form__h">{t('postSub')}</h2>
            <div className="chips chips--wrap">
              {category.subs.map((s) => (
                <button key={s.id} className={`chip${sub === s.id ? ' on' : ''}`} onClick={() => setSub(s.id)}>
                  {pick(prefs.lang, s.name)}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="field">
          <span>{t('fTitle')}</span>
          <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder={t('fTitleHint')} />
        </label>
        <label className="field">
          <span>{t('fDesc')}</span>
          <textarea rows={4} value={desc} maxLength={3000} onChange={(e) => setDesc(e.target.value)} placeholder={t('fDescHint')} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>
              {t('fPrice')}, {country.currency === 'RUB' ? '₽' : country.currency === 'USD' ? '$' : '₩'}
            </span>
            <input inputMode="numeric" value={price} maxLength={12} onChange={(e) => setPrice(e.target.value.replace(/[^\d\s]/g, ''))} placeholder={t('free')} />
          </label>
          <label className="field">
            <span>{t('fPeriod')}</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period | '')}>
              <option value="">{t('pNone')}</option>
              {(Object.keys(PERIOD_KEY) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {t(PERIOD_KEY[p])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t('fPhone')}</span>
          <input inputMode="tel" type="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="switch">
          <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
          <span>{t('fWhatsapp')}</span>
        </label>
        <div className="field">
          <span>
            {t('fPhoto')} · {t('maxPhotos')}
          </span>
          <div className="photos">
            {photos.map((src) => (
              <span key={src} className="photos__item">
                <img src={src} alt="" />
                <button onClick={() => setPhotos((prev) => prev.filter((p) => p !== src))} aria-label={t('delete')}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <span key={`u${i}`} className="photos__item photos__item--loading">…</span>
            ))}
            {photos.length + uploading < 6 && (
              <label className="photos__add">
                <Icon name="camera" size={26} />
                <small>{t('addPhoto')}</small>
                <input type="file" accept="image/*" multiple onChange={onFiles} hidden />
              </label>
            )}
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy || uploading > 0} onClick={submit}>
          {uploading > 0 ? t('uploading') : busy ? t('loading') : editing ? t('saveChanges') : t('publish')}
        </button>
      </div>
    </>
  )
}

export function shrink(file: File, max: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })
}

/* ---------- profile ---------- */

function ProfileTab({ ctx }: { ctx: Ctx }) {
  const { prefs, t, country, profile } = ctx
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const lang = LANGS.find((l) => l.id === prefs.lang)!
  const settings = (
    <div className="menu">
      <button onClick={() => ctx.setSheet({ type: 'lang' })}>
        <Icon name="globe" /> {t('language')}
        <em>
          {lang.flag} {lang.name}
        </em>
        <Icon name="chevron" size={18} />
      </button>
      <button onClick={() => ctx.setSheet({ type: 'location' })}>
        <Icon name="pin" /> {t('country')}
        <em>
          {country.flag} {cityName(ctx, prefs.country, prefs.city)}
        </em>
        <Icon name="chevron" size={18} />
      </button>
      <button onClick={() => ctx.push({ type: 'terms' })}>
        <Icon name="doc" /> {t('terms')}
        <Icon name="chevron" size={18} />
      </button>
    </div>
  )

  if (!ctx.me) {
    return (
      <>
        <header className="feed-head">
          <h1>{t('tabProfile')}</h1>
        </header>
        <div className="pad">
          <div className="me">
            <span className="avatar avatar--lg">🙂</span>
            <span>
              <b>{t('profileGuest')}</b>
              <small>{t('authWhy')}</small>
            </span>
          </div>
          <button className="btn btn--primary btn--block btn--lg profile-signin" onClick={() => ctx.push({ type: 'auth' })}>
            {t('signIn')}
          </button>
          {settings}
        </div>
      </>
    )
  }

  const myCount = ctx.all.filter((l) => l.mine).length
  return (
    <>
      <header className="feed-head">
        <h1>{t('tabProfile')}</h1>
      </header>
      <div className="pad">
        <button className="me me--btn" onClick={() => ctx.push({ type: 'profileEdit' })}>
          {profile ? <PersonAvatar p={profile} size={64} /> : <span className="avatar avatar--lg">🙂</span>}
          <span>
            <b>{profile?.name || t('profileGuest')}</b>
            <small>{ctx.email}</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <div className="menu">
          <button onClick={() => ctx.push({ type: 'profileEdit' })}>
            <Icon name="user" /> {t('editProfile')}
            <Icon name="chevron" size={18} />
          </button>
          <button onClick={() => ctx.push({ type: 'my', mode: 'mine' })}>
            <Icon name="list" /> {t('myListings')}
            <em>{myCount || ''}</em>
            <Icon name="chevron" size={18} />
          </button>
          <button onClick={() => ctx.push({ type: 'my', mode: 'favorites' })}>
            <Icon name="heart" /> {t('favorites')}
            <em>{ctx.favorites.length || ''}</em>
            <Icon name="chevron" size={18} />
          </button>
          <button onClick={() => ctx.setTab('chat')}>
            <Icon name="chat" /> {t('chats')}
            <em>{ctx.chats.filter((c) => c.last_at).length || ''}</em>
            <Icon name="chevron" size={18} />
          </button>
          <button onClick={() => ctx.push({ type: 'category', cat: 'people' })}>
            <Icon name="users" /> {t('dating')}
            <em>{ctx.likes.length ? `♥ ${ctx.likes.length}` : ''}</em>
            <Icon name="chevron" size={18} />
          </button>
        </div>
        {settings}
        <div className="menu">
          <button onClick={() => ctx.push({ type: 'blocked' })}>
            🚫 {t('blockedUsers')}
            <em>{ctx.blocks.length || ''}</em>
            <Icon name="chevron" size={18} />
          </button>
        </div>
        <button className="btn btn--soft btn--block" onClick={() => api.supabase.auth.signOut({ scope: 'local' })}>
          {t('signOut')}
        </button>
        <button
          className="btn btn--danger btn--block account-delete"
          disabled={busy}
          onClick={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              return
            }
            setBusy(true)
            try {
              await api.deleteAccount()
              ctx.setTab('home')
            } catch {
              ctx.toast(t('netError'))
              setBusy(false)
            }
          }}
        >
          {confirmDelete ? t('deleteAccountConfirm') : t('deleteAccount')}
        </button>
      </div>
    </>
  )
}

const LANG_CODES = ['KG', 'UZ', 'RU', 'EN', 'TJ', 'KZ', 'KR']

function ProfileEdit({ ctx }: { ctx: Ctx }) {
  const { t, profile } = ctx
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null)
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '')
  const [fromPlace, setFromPlace] = useState(profile?.from_place ?? '')
  const [langs, setLangs] = useState<string[]>(profile?.langs ?? [])
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'chat')
  const [about, setAbout] = useState(profile?.about ?? '')
  const [visible, setVisible] = useState(profile?.dating_visible ?? false)
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!ctx.me || !profile) return <TopBar ctx={ctx} title={t('loading')} />
  const me = ctx.me
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: thisYear - 18 - 1940 + 1 }, (_, i) => thisYear - 18 - i)

  async function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      setAvatar(await api.uploadPhoto(me, await shrink(file, 600)))
    } catch {
      ctx.toast(t('netError'))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setError('')
    if (!name.trim()) {
      setError(t('fillAll'))
      return
    }
    if (visible && (!gender || !birthYear)) {
      setError(`${t('gender')}, ${t('birthYear')}`)
      return
    }
    if (visible && thisYear - Number(birthYear) < 18) {
      setError(t('age18'))
      return
    }
    setBusy(true)
    try {
      const saved = await api.updateProfile(me, {
        name: name.trim(),
        phone: phone.trim(),
        gender,
        birth_year: birthYear ? Number(birthYear) : null,
        from_place: fromPlace.trim(),
        langs,
        goal,
        about: about.trim(),
        dating_visible: visible,
        avatar_url: avatar,
      })
      ctx.setProfile(saved)
      ctx.toast(t('saved'))
      ctx.pop()
    } catch {
      setError(t('netError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar ctx={ctx} title={t('editProfile')} />
      <div className="pad form">
        <div className="field">
          <span>{t('photoAvatar')}</span>
          <label className="avatar-pick">
            <PersonAvatar p={{ id: me, name: name || '?', gender, avatar_url: avatar }} size={88} />
            <span className="btn btn--soft btn--sm">{uploading ? t('uploading') : t('addPhoto')}</span>
            <input type="file" accept="image/*" onChange={onAvatar} hidden />
          </label>
        </div>
        <label className="field">
          <span>{t('yourName')}</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('fPhone')}</span>
          <input type="tel" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} placeholder={ctx.country.phonePrefix} />
        </label>
        <div className="field">
          <span>{t('yourGender')}</span>
          <div className="pick-grid">
            {(['m', 'f'] as Gender[]).map((g) => (
              <button key={g} className={`pick${gender === g ? ' on' : ''}`} onClick={() => setGender(g)}>
                <span>{g === 'm' ? '👨' : '👩'}</span>
                {t(g === 'm' ? 'male' : 'female')}
              </button>
            ))}
          </div>
        </div>
        <h2 className="form__h">{t('dating')}</h2>
        <label className="switch">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          <span>{t('datingVisible')}</span>
        </label>
        <div className="field-row">
          <label className="field">
            <span>{t('birthYear')}</span>
            <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
              <option value="">—</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('goal')}</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
              <option value="serious">{t('goalSerious')}</option>
              <option value="chat">{t('goalChat')}</option>
              <option value="friends">{t('goalFriends')}</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t('fromPlace')}</span>
          <input value={fromPlace} maxLength={60} onChange={(e) => setFromPlace(e.target.value)} placeholder="Бишкек, Ош, Ташкент…" />
        </label>
        <div className="field">
          <span>{t('languages')}</span>
          <div className="chips chips--wrap">
            {LANG_CODES.map((code) => (
              <button key={code} className={`chip${langs.includes(code) ? ' on' : ''}`} onClick={() => setLangs(langs.includes(code) ? langs.filter((l) => l !== code) : [...langs, code])}>
                {code}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>{t('aboutMe')}</span>
          <textarea rows={4} value={about} maxLength={1000} onChange={(e) => setAbout(e.target.value)} placeholder={t('aboutHint')} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy || uploading} onClick={save}>
          {busy ? t('loading') : t('save')}
        </button>
      </div>
    </>
  )
}

function MyListings({ ctx, mode }: { ctx: Ctx; mode: 'mine' | 'favorites' }) {
  const { t } = ctx
  const [loaded, setLoaded] = useState(mode === 'favorites')

  useEffect(() => {
    if (mode !== 'mine' || !ctx.me) return
    api
      .fetchMyListings(ctx.me)
      .then((items) => {
        items.forEach(ctx.upsertListing)
        setLoaded(true)
      })
      .catch(() => {
        ctx.toast(t('netError'))
        setLoaded(true)
      })
  }, [mode, ctx.me])

  const items =
    mode === 'mine'
      ? ctx.all.filter((l) => l.mine).sort((a, b) => b.createdAt - a.createdAt)
      : ctx.all.filter((l) => ctx.favorites.includes(l.id) && l.status === 'active')
  return (
    <>
      <TopBar ctx={ctx} title={t(mode === 'mine' ? 'myListings' : 'favorites')} />
      <div className="pad">{loaded ? <Grid ctx={ctx} items={items} /> : <p className="muted small">{t('loading')}</p>}</div>
    </>
  )
}

function BlockedList({ ctx }: { ctx: Ctx }) {
  const [people, setPeople] = useState<Profile[] | null>(null)
  useEffect(() => {
    api.fetchPeopleByIds(ctx.blocks).then(setPeople).catch(() => setPeople([]))
  }, [])
  return (
    <>
      <TopBar ctx={ctx} title={ctx.t('blockedUsers')} />
      <div className="pad">
        {people === null && <p className="muted small">{ctx.t('loading')}</p>}
        {people?.length === 0 && <div className="empty"><small>{ctx.t('nothing')}</small></div>}
        <div className="chatlist">
          {people?.filter((p) => ctx.blocks.includes(p.id)).map((p) => (
            <div key={p.id} className="chatrow">
              <PersonAvatar p={p} size={44} />
              <span className="chatrow__body">
                <b>{p.name}</b>
              </span>
              <span className="linkrow">
                <BlockButton ctx={ctx} userId={p.id} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---------- sheets ---------- */

function SheetFrame({ ctx, title, children }: { ctx: Ctx; title: string; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={() => ctx.setSheet(null)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <b>{title}</b>
          <button className="round-btn round-btn--plain" onClick={() => ctx.setSheet(null)} aria-label={ctx.t('close')}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LocationSheet({ ctx }: { ctx: Ctx }) {
  const { prefs, updatePrefs } = ctx
  const [countryId, setCountryId] = useState<CountryId>(prefs.country)
  return (
    <SheetFrame ctx={ctx} title={ctx.t('country')}>
      <div className="segmented">
        {COUNTRIES.map((c) => (
          <button key={c.id} className={countryId === c.id ? 'on' : ''} onClick={() => setCountryId(c.id)}>
            {c.flag} {pick(prefs.lang, c.name)}
          </button>
        ))}
      </div>
      <div className="sheet__list">
        {countryOf(countryId).cities.map((c) => {
          const on = prefs.country === countryId && prefs.city === c.id
          const count = countryId === prefs.country ? ctx.all.filter((l) => l.status === 'active' && l.country === countryId && l.city === c.id).length : null
          return (
            <button
              key={c.id}
              className={on ? 'on' : ''}
              onClick={() => {
                updatePrefs({ country: countryId, city: c.id })
                if (ctx.me) api.updateProfile(ctx.me, { country: countryId, city: c.id }).then(ctx.setProfile).catch(() => undefined)
                ctx.setSheet(null)
              }}
            >
              {pick(prefs.lang, c.name)}
              {count !== null && <small>{count}</small>}
              {on && <Icon name="check" size={18} />}
            </button>
          )
        })}
      </div>
    </SheetFrame>
  )
}

function LangSheet({ ctx }: { ctx: Ctx }) {
  return (
    <SheetFrame ctx={ctx} title={ctx.t('language')}>
      <div className="sheet__list">
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={ctx.prefs.lang === l.id ? 'on' : ''}
            onClick={() => {
              ctx.updatePrefs({ lang: l.id })
              ctx.setSheet(null)
            }}
          >
            {l.flag} {l.name}
            {ctx.prefs.lang === l.id && <Icon name="check" size={18} />}
          </button>
        ))}
      </div>
    </SheetFrame>
  )
}

function ReportSheet({ ctx, listing, user }: { ctx: Ctx; listing?: string; user?: string }) {
  const [busy, setBusy] = useState(false)
  const reasons: Key[] = ['reasonScam', 'reasonSpam', 'reasonOffensive', 'reasonOther']
  return (
    <SheetFrame ctx={ctx} title={ctx.t('reportReason')}>
      <div className="sheet__list">
        {reasons.map((r) => (
          <button
            key={r}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await api.report({ listing_id: listing, user_id: user }, translate('ru', r))
                ctx.toast(ctx.t('reportSent'))
                ctx.setSheet(null)
              } catch {
                ctx.toast(ctx.t('netError'))
                setBusy(false)
              }
            }}
          >
            {ctx.t(r)}
          </button>
        ))}
      </div>
    </SheetFrame>
  )
}
