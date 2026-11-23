import { createClient, type Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import type { CountryId, Listing, Period } from './data'
import type { Gender, Goal } from './people'

const URL = import.meta.env.VITE_SUPABASE_URL as string
const KEY = import.meta.env.VITE_SUPABASE_KEY as string

// В iOS-приложении сессию храним в нативном хранилище: WKWebView может очистить localStorage.
const nativeStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => Preferences.set({ key, value }),
  removeItem: async (key: string) => Preferences.remove({ key }),
}

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: Capacitor.isNativePlatform() ? nativeStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export type { Session }

export interface Profile {
  id: string
  name: string
  gender: Gender | null
  birth_year: number | null
  from_place: string
  langs: string[]
  goal: Goal
  about: string
  country: CountryId
  city: string
  phone: string
  dating_visible: boolean
  avatar_url: string | null
  last_seen: string
  created_at: string
}

export interface Person {
  id: string
  name: string
  gender: Gender
  birth_year: number | null
  from_place: string
  langs: string[]
  goal: Goal
  about: string
  avatar_url: string | null
  online: boolean
  city: string
  distance_km: number | null
  dx_km: number | null
  dy_km: number | null
}

export interface ChatRow {
  id: string
  kind: 'listing' | 'person'
  listing_id: string | null
  listing_title: string | null
  listing_photo: string | null
  listing_price: number | null
  listing_period: Period | null
  listing_country: CountryId | null
  peer_id: string
  peer_name: string
  peer_avatar: string | null
  peer_gender: Gender | null
  peer_birth_year: number | null
  last_body: string | null
  last_sender: string | null
  last_at: string | null
  unread: number
  blocked: boolean
}

export interface Message {
  id: number
  chat_id: string
  sender: string
  body: string
  created_at: string
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/* ---------- объявления ---------- */

const LISTING_FIELDS = '*, author:profiles!listings_owner_fkey(name, avatar_url, created_at)'

interface ListingRow {
  id: string
  owner: string
  country: CountryId
  city: string
  cat: string
  sub: string
  title: string
  description: string
  price: number | null
  period: Period | null
  phone: string
  whatsapp: boolean
  photos: string[]
  premium: boolean
  views: number
  status: 'active' | 'hidden'
  attrs: Record<string, string | number | boolean | string[]> | null
  created_at: string
  author: { name: string; avatar_url: string | null; created_at: string } | null
}

function toListing(row: ListingRow, me: string | null): Listing {
  return {
    id: row.id,
    owner: row.owner,
    country: row.country,
    city: row.city,
    cat: row.cat,
    sub: row.sub,
    title: row.title,
    desc: row.description,
    price: row.price === null ? null : Number(row.price),
    period: row.period ?? undefined,
    author: row.author?.name || '—',
    authorAvatar: row.author?.avatar_url,
    since: new Date(row.author?.created_at ?? row.created_at).getFullYear(),
    phone: row.phone,
    whatsapp: row.whatsapp,
    createdAt: new Date(row.created_at).getTime(),
    premium: row.premium,
    photo: row.photos[0],
    photos: row.photos,
    views: row.views,
    status: row.status,
    attrs: row.attrs ?? {},
    mine: me !== null && row.owner === me,
  }
}

export async function fetchListings(country: CountryId, me: string | null): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('country', country)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(500)
  fail(error)
  return (data as ListingRow[]).map((r) => toListing(r, me))
}

export async function fetchListingsByIds(ids: string[], me: string | null): Promise<Listing[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('listings').select(LISTING_FIELDS).in('id', ids)
  fail(error)
  return (data as ListingRow[]).map((r) => toListing(r, me))
}

export async function fetchMyListings(me: string): Promise<Listing[]> {
  const { data, error } = await supabase.from('listings').select(LISTING_FIELDS).eq('owner', me).order('created_at', { ascending: false })
  fail(error)
  return (data as ListingRow[]).map((r) => toListing(r, me))
}

export interface ListingInput {
  country: CountryId
  city: string
  cat: string
  sub: string
  title: string
  description: string
  price: number | null
  period: Period | null
  phone: string
  whatsapp: boolean
  photos: string[]
  attrs: Record<string, string | number | boolean | string[]>
}

export async function createListing(input: ListingInput, me: string): Promise<Listing> {
  const { data, error } = await supabase.from('listings').insert(input).select(LISTING_FIELDS).single()
  fail(error)
  return toListing(data as ListingRow, me)
}

export async function updateListing(id: string, patch: Partial<ListingInput> & { status?: 'active' | 'hidden' }, me: string): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(LISTING_FIELDS)
    .single()
  fail(error)
  return toListing(data as ListingRow, me)
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  fail(error)
}

export async function markViewed(id: string) {
  await supabase.rpc('listing_viewed', { p_id: id })
}

/* ---------- фото ---------- */

export async function uploadPhoto(me: string, blob: Blob): Promise<string> {
  const path = `${me}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  fail(error)
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

/* ---------- профиль ---------- */

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  fail(error)
  return data as Profile | null
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at'>>

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select('*').single()
  fail(error)
  return data as Profile
}

export async function deleteAccount() {
  // Пользователя, его фото и все данные удаляет серверная функция delete-account.
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  fail(error)
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
}

/* ---------- избранное, лайки, блокировки, жалобы ---------- */

export async function fetchIds(table: 'favorites' | 'likes' | 'blocks'): Promise<string[]> {
  const column = table === 'favorites' ? 'listing_id' : table === 'likes' ? 'person_id' : 'blocked_id'
  const { data, error } = await supabase.from(table).select(column)
  fail(error)
  return (data as unknown as Record<string, string>[]).map((r) => r[column])
}

export async function setFavorite(listingId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('favorites').upsert({ listing_id: listingId }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })
    : await supabase.from('favorites').delete().eq('listing_id', listingId)
  fail(error)
}

export async function setLike(personId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('likes').upsert({ person_id: personId }, { onConflict: 'user_id,person_id', ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('person_id', personId)
  fail(error)
}

export async function setBlocked(userId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('blocks').upsert({ blocked_id: userId }, { onConflict: 'user_id,blocked_id', ignoreDuplicates: true })
    : await supabase.from('blocks').delete().eq('blocked_id', userId)
  fail(error)
}

export async function report(target: { listing_id?: string; user_id?: string }, reason: string) {
  const { error } = await supabase.from('reports').insert({ ...target, reason })
  fail(error)
}

export async function fetchPeopleByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids)
  fail(error)
  return data as Profile[]
}

/* ---------- чаты ---------- */

export async function startChat(target: { listing?: string; person?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('start_chat', { p_listing: target.listing ?? null, p_person: target.person ?? null })
  fail(error)
  return data as string
}

export async function fetchChats(): Promise<ChatRow[]> {
  const { data, error } = await supabase.rpc('my_chats')
  fail(error)
  return data as ChatRow[]
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at').limit(1000)
  fail(error)
  return data as Message[]
}

export async function sendMessage(chatId: string, body: string): Promise<Message> {
  const { data, error } = await supabase.from('messages').insert({ chat_id: chatId, body }).select('*').single()
  fail(error)
  return data as Message
}

export async function markRead(chatId: string, me: string) {
  await supabase.from('chat_reads').upsert({ chat_id: chatId, user_id: me, read_at: new Date().toISOString() })
}

/* ---------- знакомства ---------- */

export async function setMyLocation(lat: number, lng: number) {
  const { error } = await supabase.rpc('set_my_location', { p_lat: lat, p_lng: lng })
  fail(error)
}

export async function nearbyPeople(radiusKm: number, gender: Gender | null): Promise<Person[]> {
  const { data, error } = await supabase.rpc('nearby_people', { p_radius_km: radiusKm, p_gender: gender })
  fail(error)
  return data as Person[]
}
