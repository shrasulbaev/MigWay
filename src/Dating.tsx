import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { BlockButton, Grid, PersonAvatar, TopBar, type Ctx } from './App'
import { Icon } from './Icon'
import { ageOf, avatarStyle, type Gender, type Goal } from './people'
import * as api from './api'
import type { Person } from './api'

type Seek = Gender | 'all'
type View = 'map' | 'list' | 'ads'
type AgeRange = 'all' | '18' | '26' | '36'

const AGE: Record<AgeRange, [number, number]> = { all: [18, 99], '18': [18, 25], '26': [26, 35], '36': [36, 99] }
const GOAL_KEY = { serious: 'goalSerious', chat: 'goalChat', friends: 'goalFriends' } as const
const RADII = [5, 10, 25, 50]

export function opposite(g: Gender | null | undefined): Seek {
  return g === 'm' ? 'f' : g === 'f' ? 'm' : 'all'
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] })
      if (perm.location === 'denied' && perm.coarseLocation === 'denied') return null
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    }
    return await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
      )
    })
  } catch {
    return null
  }
}

export function DatingScreen({ ctx }: { ctx: Ctx }) {
  const { t, profile } = ctx
  const [view, setView] = useState<View>('map')
  const [seek, setSeek] = useState<Seek>(opposite(profile?.gender))
  const [age, setAge] = useState<AgeRange>('all')
  const [goal, setGoal] = useState<Goal | 'all'>('all')
  const [radius, setRadius] = useState(25)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [located, setLocated] = useState<boolean | null>(null)
  const [list, setList] = useState<Person[] | null>(null)
  const [failed, setFailed] = useState(false)
  const ready = Boolean(ctx.me && profile?.dating_visible)

  useEffect(() => {
    if (!ready) return
    let alive = true
    currentPosition().then(async (pos) => {
      if (!alive) return
      if (pos) await api.setMyLocation(pos.lat, pos.lng).catch(() => undefined)
      setLocated(Boolean(pos))
      if (!pos) setView('list')
    })
    return () => {
      alive = false
    }
  }, [ready])

  useEffect(() => {
    if (!ready || located === null) return
    let alive = true
    const load = () =>
      api
        .nearbyPeople(radius, seek === 'all' ? null : seek)
        .then((people) => {
          if (!alive) return
          setFailed(false)
          setList(people)
          ctx.rememberPeople(people)
        })
        .catch(() => alive && setFailed(true))
    load()
    // люди появляются и уходят из сети: обновляем список раз в 30 секунд
    const id = window.setInterval(load, 30_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [ready, located, radius, seek, ctx.blocks.length])

  const [minAge, maxAge] = AGE[age]
  const people = (list ?? []).filter((p) => {
    const a = ageOf(p.birth_year)
    return (age === 'all' || (a !== null && a >= minAge && a <= maxAge)) && (goal === 'all' || p.goal === goal)
  })
  const onMap = people.filter((p) => p.dx_km !== null && p.dy_km !== null)
  // масштаб карты подстраивается под самых дальних людей, чтобы метки не сливались с «Вы здесь»
  const span = Math.max(2, ...onMap.map((p) => Math.max(Math.abs(p.dx_km!), Math.abs(p.dy_km!)) + 1))
  const ads = ctx.local.filter((l) => l.cat === 'people')
  const chosen = selected ? people.find((p) => p.id === selected) : undefined

  return (
    <>
      <TopBar ctx={ctx} title={t('dating')} />
      <div className="pad">
        <div className="segmented segmented--3">
          {(['map', 'list', 'ads'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {t(v === 'map' ? 'viewMap' : v === 'list' ? 'viewList' : 'viewAds')}
            </button>
          ))}
        </div>
      </div>

      {view !== 'ads' && !ready && (
        <div className="pad">
          <div className="gender-prompt">
            <b>{t('datingCta')}</b>
            <button className="btn btn--primary" onClick={() => (ctx.me ? ctx.push({ type: 'profileEdit' }) : ctx.push({ type: 'auth' }))}>
              {ctx.me ? t('datingCtaBtn') : t('signIn')}
            </button>
          </div>
        </div>
      )}

      {view !== 'ads' && ready && (
        <>
          <div className="chips">
            {(['f', 'm', 'all'] as Seek[]).map((s) => (
              <button key={s} className={`chip${seek === s ? ' on' : ''}`} onClick={() => setSeek(s)}>
                {t(s === 'f' ? 'women' : s === 'm' ? 'men' : 'everyone')}
              </button>
            ))}
            <button className={`chip chip--icon${showFilters ? ' on' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Icon name="sliders" size={16} /> {t('filters')}
            </button>
          </div>
          {showFilters && (
            <div className="pad dfilters">
              <span>{t('ageF')}</span>
              <div className="chips chips--wrap">
                {(['all', '18', '26', '36'] as AgeRange[]).map((a) => (
                  <button key={a} className={`chip${age === a ? ' on' : ''}`} onClick={() => setAge(a)}>
                    {a === 'all' ? t('all') : a === '36' ? '36+' : `${AGE[a][0]}–${AGE[a][1]}`}
                  </button>
                ))}
              </div>
              <span>{t('goal')}</span>
              <div className="chips chips--wrap">
                {(['all', 'serious', 'chat', 'friends'] as (Goal | 'all')[]).map((g) => (
                  <button key={g} className={`chip${goal === g ? ' on' : ''}`} onClick={() => setGoal(g)}>
                    {g === 'all' ? t('all') : t(GOAL_KEY[g])}
                  </button>
                ))}
              </div>
              {located && (
                <>
                  <span>{t('radius')}</span>
                  <div className="chips chips--wrap">
                    {RADII.map((r) => (
                      <button key={r} className={`chip${radius === r ? ' on' : ''}`} onClick={() => setRadius(r)}>
                        {r} {t('km')}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {located === false && <p className="muted small pad">📍 {t('locationOff')}</p>}
          {(located === null || (list === null && !failed)) && <p className="muted small pad">{t('loading')}</p>}
          {failed && <p className="muted small pad">{t('netError')}</p>}
        </>
      )}

      {view === 'map' && ready && located !== false && list !== null && (
        <div className="pad">
          <div className="map" onClick={() => setSelected(null)}>
            <MapArt />
            <span className="map__radius" style={{ width: `${Math.min(100, (radius / span) * 100)}%` }} />
            <span className="map__me">
              <i />
              <b>{t('you2')}</b>
            </span>
            {onMap.map((p) => (
              <button
                key={p.id}
                className={`map__pin${selected === p.id ? ' on' : ''}${p.gender === 'f' ? ' map__pin--f' : ''}`}
                style={{ left: `${50 + clamp(((p.dx_km! + jitter(p.id, 0)) / span) * 50)}%`, top: `${50 + clamp(((p.dy_km! + jitter(p.id, 1)) / span) * 50)}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(p.id)
                }}
                aria-label={p.name}
              >
                <PersonAvatar p={p} size={40} />
              </button>
            ))}
            {chosen && (
              <div className="map__card" onClick={(e) => e.stopPropagation()}>
                <PersonAvatar p={chosen} size={52} />
                <span className="map__card-body">
                  <b>{title(ctx, chosen)}</b>
                  <small>{meta(ctx, chosen)}</small>
                  <small>{t(GOAL_KEY[chosen.goal])}</small>
                </span>
                <button className="btn btn--primary btn--sm" onClick={() => ctx.push({ type: 'person', id: chosen.id })}>
                  {t('profileBtn')}
                </button>
              </div>
            )}
          </div>
          <p className="muted small map__note">
            <Icon name="eye" size={14} /> {t('approx')}
          </p>
          {people.length === 0 && <div className="empty"><small>{t('noPeople')}</small></div>}
        </div>
      )}

      {view === 'list' && ready && list !== null && (
        <div className="pad">
          {people.length === 0 ? (
            <div className="empty"><small>{t('noPeople')}</small></div>
          ) : (
            <div className="grid">
              {people.map((p) => (
                <PersonCard key={p.id} ctx={ctx} person={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'ads' && (
        <div className="pad">
          <Grid ctx={ctx} items={ads} />
        </div>
      )}
      <div className="detail-gap" />
    </>
  )
}

// стабильный сдвиг метки на ±0,45 км: координаты округлены до 1 км, иначе соседи ложатся друг на друга
function jitter(id: string, axis: number) {
  let h = axis * 7919
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100003
  const v = (h % 1000) / 1000 - 0.5
  return v * 0.9 + (Math.abs(v) < 0.2 ? Math.sign(v || 1) * 0.35 : 0)
}

function clamp(v: number) {
  return Math.max(-46, Math.min(46, v))
}

function title(ctx: Ctx, p: { name: string; birth_year: number | null }) {
  const a = ageOf(p.birth_year)
  return a ? `${p.name}, ${ctx.t('years', { n: a })}` : p.name
}

function meta(ctx: Ctx, p: Person) {
  const parts: string[] = []
  if (p.distance_km !== null) parts.push(ctx.t('kmAway', { n: p.distance_km }))
  if (p.from_place) parts.push(ctx.t('fromCity', { c: p.from_place }))
  return parts.join(' · ')
}

function PersonCard({ ctx, person }: { ctx: Ctx; person: Person }) {
  const { t } = ctx
  const liked = ctx.likes.includes(person.id)
  return (
    <button className="card" onClick={() => ctx.push({ type: 'person', id: person.id })}>
      <div className="card__media pcover" style={avatarStyle(person)}>
        {!person.avatar_url && <span className="pcover__letter">{person.name.slice(0, 1)}</span>}
        {person.online && <span className="tag-online">{t('online')}</span>}
        {liked && (
          <span className="fav fav--on">
            <Icon name="heart" size={14} filled />
          </span>
        )}
      </div>
      <span className="price">{t(GOAL_KEY[person.goal])}</span>
      <span className="card__title">{title(ctx, person)}</span>
      <span className="card__meta">{meta(ctx, person)}</span>
    </button>
  )
}

export function PersonScreen({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = ctx
  const cached = ctx.people[id]
  const [loaded, setLoaded] = useState<api.Profile | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (cached) return
    api
      .fetchProfile(id)
      .then((p) => (p ? setLoaded(p) : setMissing(true)))
      .catch(() => setMissing(true))
  }, [id])

  const person: Person | null = cached
    ? cached
    : loaded && loaded.gender
      ? {
          ...loaded,
          gender: loaded.gender,
          online: Date.now() - new Date(loaded.last_seen).getTime() < 10 * 60_000,
          distance_km: null,
          dx_km: null,
          dy_km: null,
        }
      : null

  if (!person) return <TopBar ctx={ctx} title={missing || (loaded && !loaded.gender) ? t('nothing') : t('loading')} />
  const liked = ctx.likes.includes(person.id)
  const isMe = person.id === ctx.me
  return (
    <>
      <div className="scroll">
        <div className="hero pcover" style={avatarStyle(person)}>
          {!person.avatar_url && <span className="pcover__letter pcover__letter--big">{person.name.slice(0, 1)}</span>}
          <button className="round-btn round-btn--glass hero__back" onClick={ctx.pop} aria-label="Назад">
            <Icon name="back" />
          </button>
          {!isMe && (
            <div className="hero__right">
              <button className={`round-btn round-btn--glass${liked ? ' liked' : ''}`} onClick={() => ctx.toggleLike(person.id)} aria-label={t('like')}>
                <Icon name="heart" size={20} filled={liked} />
              </button>
            </div>
          )}
        </div>
        <div className="pad detail">
          <h1 className="detail__title detail__title--big">
            {title(ctx, person)}
            {person.online && <span className="online-dot">{t('online')}</span>}
          </h1>
          <div className="detail__meta">
            {person.distance_km !== null && (
              <span>
                <Icon name="pin" size={16} /> {t('kmAway', { n: person.distance_km })}
              </span>
            )}
            {person.from_place && (
              <span>
                <Icon name="home" size={16} /> {t('fromCity', { c: person.from_place })}
              </span>
            )}
          </div>
          {person.about && (
            <>
              <h2 className="detail__h">{t('aboutMe')}</h2>
              <p className="detail__desc">{person.about}</p>
            </>
          )}
          <dl className="props">
            <div>
              <dt>{t('goal')}:</dt>
              <dd>{t(GOAL_KEY[person.goal])}</dd>
            </div>
            {person.langs.length > 0 && (
              <div>
                <dt>{t('languages')}:</dt>
                <dd>{person.langs.join(', ')}</dd>
              </div>
            )}
          </dl>
          <div className="safety">{t('datingSafety')}</div>
          {!isMe && (
            <div className="linkrow">
              <button onClick={() => ctx.requireAuth() && ctx.setSheet({ type: 'report', user: person.id })}>⚠️ {t('report')}</button>
              <BlockButton ctx={ctx} userId={person.id} after={ctx.pop} />
            </div>
          )}
        </div>
        <div className="detail-gap" />
      </div>
      {!isMe && (
        <div className="actionbar">
          <button className={`btn btn--soft${liked ? ' btn--liked' : ''}`} onClick={() => ctx.toggleLike(person.id)}>
            <Icon name="heart" size={18} filled={liked} /> {t(liked ? 'liked' : 'like')}
          </button>
          <button className="btn btn--primary" onClick={() => ctx.openChat({ person: person.id })}>
            <Icon name="chat" size={18} /> {t('write')}
          </button>
        </div>
      )}
    </>
  )
}

function MapArt() {
  return (
    <svg className="map__art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="100" fill="#eef1ec" />
      <path d="M62 0 C 58 20, 70 35, 64 55 S 52 85, 58 100 L 66 100 C 60 85, 72 70, 72 55 S 66 20, 70 0 Z" fill="#cfe3f1" />
      <rect x="8" y="10" width="22" height="16" rx="3" fill="#d7ead9" />
      <rect x="74" y="66" width="18" height="22" rx="3" fill="#d7ead9" />
      <rect x="14" y="70" width="14" height="10" rx="2" fill="#d7ead9" />
      <g stroke="#ffffff" strokeWidth="2.2" fill="none">
        <path d="M0 38 H100" />
        <path d="M0 74 H100" />
        <path d="M34 0 V100" />
        <path d="M84 0 V100" />
        <path d="M0 92 L48 48 L100 18" />
      </g>
      <g stroke="#ffffff" strokeWidth="1" fill="none" opacity=".9">
        <path d="M0 18 H60" />
        <path d="M0 56 H100" />
        <path d="M16 0 V100" />
        <path d="M50 0 V100" />
      </g>
    </svg>
  )
}
