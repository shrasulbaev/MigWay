-- MigWay: схема базы для Supabase (Postgres 17)
-- Профили, объявления, избранное, чаты, знакомства, жалобы и блокировки.

create extension if not exists pgcrypto;

-- ---------- профили ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  gender text check (gender in ('m', 'f')),
  birth_year int check (birth_year between 1930 and 2010),
  from_place text not null default '' check (char_length(from_place) <= 60),
  langs text[] not null default '{}',
  goal text not null default 'chat' check (goal in ('serious', 'chat', 'friends')),
  about text not null default '' check (char_length(about) <= 1000),
  country text not null default 'ru' check (country in ('ru', 'us', 'kr')),
  city text not null default 'moscow',
  phone text not null default '' check (char_length(phone) <= 30),
  dating_visible boolean not null default false,
  avatar_url text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, gender, birth_year, from_place, langs, goal, about, country, city, phone, dating_visible, avatar_url, last_seen)
  on public.profiles to authenticated;

-- профиль создаётся вместе с пользователем
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, gender, country, city)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 40),
    case when new.raw_user_meta_data ->> 'gender' in ('m', 'f') then new.raw_user_meta_data ->> 'gender' end,
    case when new.raw_user_meta_data ->> 'country' in ('ru', 'us', 'kr') then new.raw_user_meta_data ->> 'country' else 'ru' end,
    left(coalesce(new.raw_user_meta_data ->> 'city', 'moscow'), 40)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- объявления ----------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country text not null check (country in ('ru', 'us', 'kr')),
  city text not null check (char_length(city) <= 40),
  cat text not null check (char_length(cat) <= 20),
  sub text not null check (char_length(sub) <= 20),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 3000),
  price bigint check (price >= 0 and price < 100000000000),
  period text check (period in ('month', 'day', 'hour', 'week', 'kg')),
  phone text not null default '' check (char_length(phone) <= 30),
  whatsapp boolean not null default false,
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  premium boolean not null default false,
  views int not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_feed on public.listings (country, city, status, created_at desc);
create index listings_owner on public.listings (owner);

alter table public.listings enable row level security;
create policy "active listings are public" on public.listings for select using (status = 'active' or owner = auth.uid());
create policy "post own listings" on public.listings for insert to authenticated with check (owner = auth.uid());
create policy "edit own listings" on public.listings for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "delete own listings" on public.listings for delete to authenticated using (owner = auth.uid());
revoke insert, update on public.listings from anon, authenticated;
grant insert (country, city, cat, sub, title, description, price, period, phone, whatsapp, photos) on public.listings to authenticated;
grant update (country, city, cat, sub, title, description, price, period, phone, whatsapp, photos, status, updated_at) on public.listings to authenticated;

create or replace function public.listing_viewed(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.listings set views = views + 1
  where id = p_id and status = 'active' and owner is distinct from auth.uid();
$$;

-- ---------- избранное, лайки, блокировки, жалобы ----------
create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.favorites enable row level security;
create policy "own favorites" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id),
  check (user_id <> person_id)
);
alter table public.likes enable row level security;
create policy "own likes" on public.likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.blocks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "send reports" on public.reports for insert to authenticated with check (reporter = auth.uid());

-- ---------- чаты ----------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('listing', 'person')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b)
);
-- один чат на пару людей и объявление; один личный чат на пару людей (после удаления объявления чат остаётся)
create unique index chats_listing_unique on public.chats (user_a, user_b, listing_id) where listing_id is not null;
create unique index chats_person_unique on public.chats (user_a, user_b) where kind = 'person';

alter table public.chats enable row level security;
create policy "own chats" on public.chats for select to authenticated using (auth.uid() in (user_a, user_b));
revoke insert, update, delete on public.chats from anon, authenticated;

create table public.messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_chat on public.messages (chat_id, created_at);

alter table public.messages enable row level security;
create policy "read own chat messages" on public.messages for select to authenticated
  using (exists (select 1 from public.chats c where c.id = chat_id and auth.uid() in (c.user_a, c.user_b)));
create policy "write to own chats" on public.messages for insert to authenticated
  with check (
    sender = auth.uid()
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and auth.uid() in (c.user_a, c.user_b)
        and not public.is_blocked(c.user_a, c.user_b)
    )
  );
revoke update, delete on public.messages from anon, authenticated;

create table public.chat_reads (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
alter table public.chat_reads enable row level security;
create policy "own reads" on public.chat_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end $$;
create trigger messages_touch_chat after insert on public.messages for each row execute function public.touch_chat();

-- открыть (или найти) чат с автором объявления или с человеком из знакомств
create or replace function public.start_chat(p_listing uuid default null, p_person uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  a uuid;
  b uuid;
  chat uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_listing is not null then
    select owner into other from public.listings where id = p_listing and status = 'active';
    if other is null then raise exception 'listing not found'; end if;
  else
    other := p_person;
    p_listing := null;
    if not exists (select 1 from public.profiles where id = other) then raise exception 'person not found'; end if;
  end if;
  if other = me then raise exception 'cannot chat with yourself'; end if;
  if public.is_blocked(me, other) then raise exception 'blocked'; end if;
  a := least(me, other);
  b := greatest(me, other);
  if p_listing is null then
    select id into chat from public.chats where user_a = a and user_b = b and kind = 'person';
  else
    select id into chat from public.chats where user_a = a and user_b = b and listing_id = p_listing;
  end if;
  if chat is null then
    insert into public.chats (listing_id, user_a, user_b, kind)
    values (p_listing, a, b, case when p_listing is null then 'person' else 'listing' end)
    returning id into chat;
  end if;
  return chat;
end $$;

-- список моих чатов с последним сообщением и счётчиком непрочитанных
create or replace function public.my_chats() returns table (
  id uuid, kind text, listing_id uuid, listing_title text, listing_photo text, listing_price bigint,
  listing_period text, listing_country text,
  peer_id uuid, peer_name text, peer_avatar text, peer_gender text, peer_birth_year int,
  last_body text, last_sender uuid, last_at timestamptz, unread int, blocked boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.listing_id, l.title, l.photos[1], l.price, l.period, l.country,
         p.id, p.name, p.avatar_url, p.gender, p.birth_year,
         m.body, m.sender, m.created_at,
         (select count(*)::int from public.messages x
            where x.chat_id = c.id and x.sender <> auth.uid()
              and x.created_at > coalesce(r.read_at, '-infinity'::timestamptz)),
         public.is_blocked(c.user_a, c.user_b)
  from public.chats c
  join public.profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join public.listings l on l.id = c.listing_id
  left join public.chat_reads r on r.chat_id = c.id and r.user_id = auth.uid()
  left join lateral (
    select body, sender, created_at from public.messages where chat_id = c.id order by created_at desc limit 1
  ) m on true
  where auth.uid() in (c.user_a, c.user_b)
  order by coalesce(m.created_at, c.created_at) desc;
$$;

-- ---------- знакомства: местоположение и люди рядом ----------
create table public.user_locations (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.user_locations enable row level security;
create policy "own location" on public.user_locations for select to authenticated using (user_id = auth.uid());

-- точность ~1 км: точные координаты на сервере не храним
create or replace function public.set_my_location(p_lat double precision, p_lng double precision) returns void
language sql security definer set search_path = '' as $$
  insert into public.user_locations (user_id, lat, lng, updated_at)
  values (auth.uid(), round(p_lat::numeric, 2), round(p_lng::numeric, 2), now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
$$;

create or replace function public.nearby_people(p_radius_km int default 25, p_gender text default null)
returns table (
  id uuid, name text, gender text, birth_year int, from_place text, langs text[], goal text, about text,
  avatar_url text, online boolean, city text, distance_km int, dx_km int, dy_km int
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.country, p.city, l.lat, l.lng
    from public.profiles p left join public.user_locations l on l.user_id = p.id
    where p.id = auth.uid()
  ),
  cand as (
    select p.*, l.lat as plat, l.lng as plng, me.lat as mlat, me.lng as mlng, me.country as mcountry, me.city as mcity
    from public.profiles p
    cross join me
    left join public.user_locations l on l.user_id = p.id
    where p.dating_visible and p.id <> me.id and p.gender is not null
      and (p_gender is null or p.gender = p_gender)
      and not public.is_blocked(me.id, p.id)
  ),
  measured as (
    select cand.*,
      case when plat is not null and mlat is not null then
        2 * 6371 * asin(sqrt(power(sin(radians(plat - mlat) / 2), 2) + cos(radians(mlat)) * cos(radians(plat)) * power(sin(radians(plng - mlng) / 2), 2)))
      end as dist,
      case when plat is not null and mlat is not null then (plng - mlng) * 111.32 * cos(radians(mlat)) end as dx,
      case when plat is not null and mlat is not null then (mlat - plat) * 110.57 end as dy
    from cand
  )
  select id, name, gender, birth_year, from_place, langs, goal, about, avatar_url,
         last_seen > now() - interval '10 minutes', city,
         case when dist is null then null else greatest(1, round(dist))::int end,
         round(dx)::int, round(dy)::int
  from measured
  where (dist is not null and dist <= p_radius_km)
     or (dist is null and country = mcountry and city = mcity)
  order by dist nulls last, last_seen desc
  limit 200;
$$;

-- удаление аккаунта: серверная функция supabase/functions/delete-account

revoke execute on function public.start_chat(uuid, uuid) from anon, public;
revoke execute on function public.my_chats() from anon, public;
revoke execute on function public.set_my_location(double precision, double precision) from anon, public;
revoke execute on function public.nearby_people(int, text) from anon, public;
grant execute on function public.start_chat(uuid, uuid) to authenticated;
grant execute on function public.my_chats() to authenticated;
grant execute on function public.set_my_location(double precision, double precision) to authenticated;
grant execute on function public.nearby_people(int, text) to authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_chat() from anon, authenticated, public;

-- ---------- realtime для чатов ----------
alter publication supabase_realtime add table public.messages;

-- ---------- фото ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "list own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
revoke execute on function public.is_blocked(uuid, uuid) from anon, public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;
