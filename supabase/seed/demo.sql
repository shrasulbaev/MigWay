-- Тестовые данные MigWay: учётка test@test.com и демо-пользователи *.demo@migway.test.
-- Повторный запуск ничего не дублирует.
create temporary table seed_users (n int, id uuid, email text, name text, gender text, by int, from_place text, langs text[], goal text, about text, country text, city text, phone text, dating boolean, seen_min int) on commit drop;
insert into seed_users values
 (0, gen_random_uuid(), 'test@test.com', 'Тестовый аккаунт', 'm', 1995, 'Бишкек', '{ru,ky}', 'friends', 'Аккаунт для проверки приложения.', 'ru', 'moscow', '+7 900 000-00-00', true, 0),
 (1, gen_random_uuid(), 'aibek.demo@migway.test', 'Айбек', 'm', 1992, 'Ош', '{ky,ru}', 'serious', 'Работаю прорабом, люблю футбол и горы. Ищу серьёзные отношения.', 'ru', 'moscow', '+7 916 111-22-33', true, 3),
 (2, gen_random_uuid(), 'nurgul.demo@migway.test', 'Нургуль', 'f', 1997, 'Бишкек', '{ky,ru,en}', 'chat', 'Медсестра, третий год в Москве. Люблю готовить и гулять по паркам.', 'ru', 'moscow', '+7 926 222-33-44', true, 1),
 (3, gen_random_uuid(), 'dilshod.demo@migway.test', 'Дильшод', 'm', 1990, 'Самарканд', '{uz,ru}', 'friends', 'Таксист, знаю Москву как свои пять пальцев. Помогу советом.', 'ru', 'moscow', '+7 903 333-44-55', true, 45),
 (4, gen_random_uuid(), 'malika.demo@migway.test', 'Малика', 'f', 1999, 'Ташкент', '{uz,ru}', 'serious', 'Студентка и бариста. Ищу доброго и честного человека.', 'ru', 'moscow', '+7 925 444-55-66', true, 5),
 (5, gen_random_uuid(), 'azamat.demo@migway.test', 'Азамат', 'm', 1988, 'Нарын', '{ky,ru}', 'chat', 'Электрик, свои инструменты. По выходным играю в волейбол.', 'ru', 'moscow', '+7 915 555-66-77', true, 180),
 (6, gen_random_uuid(), 'aizhan.demo@migway.test', 'Айжан', 'f', 1994, 'Каракол', '{ky,ru}', 'friends', 'Мастер маникюра. Хочу найти подруг-землячек в Москве.', 'ru', 'moscow', '+7 977 666-77-88', true, 2),
 (7, gen_random_uuid(), 'bekzod.demo@migway.test', 'Бекзод', 'm', 1996, 'Фергана', '{uz,ru,en}', 'serious', 'Программист, в Москве два года. Люблю путешествия.', 'ru', 'moscow', '+7 999 777-88-99', true, 600),
 (8, gen_random_uuid(), 'zarina.demo@migway.test', 'Зарина', 'f', 1993, 'Джалал-Абад', '{ky,uz,ru}', 'chat', 'Повар в кафе национальной кухни. Приходите в гости!', 'ru', 'moscow', '+7 968 888-99-00', true, 20),
 (9, gen_random_uuid(), 'timur.demo@migway.test', 'Тимур', 'm', 1985, 'Бишкек', '{ky,ru,en}', 'friends', 'Перевозки и посылки в Кыргызстан.', 'us', 'nyc', '+1 347 555-0101', false, 30),
 (10, gen_random_uuid(), 'gulnara.demo@migway.test', 'Гульнара', 'f', 1991, 'Ош', '{ky,ru,ko}', 'friends', 'Работаю на заводе в Ансане, помогаю с документами.', 'kr', 'seoul', '+82 10-5555-0101', false, 60);

delete from seed_users s using auth.users u where u.email = s.email;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt(case when n = 0 then '000000' else encode(extensions.gen_random_bytes(18), 'base64') end, extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', name, 'gender', gender, 'country', country, 'city', city),
  now() - (n * interval '23 days'), now(), '', '', '', ''
from seed_users;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from seed_users;

update public.profiles p set name = s.name, gender = s.gender, birth_year = s.by, from_place = s.from_place, langs = s.langs, goal = s.goal,
  about = s.about, country = s.country, city = s.city, phone = s.phone, dating_visible = s.dating, last_seen = now() - s.seen_min * interval '1 minute',
  created_at = now() - (s.n * interval '23 days')
from seed_users s where p.id = s.id;

-- объявления (только если у демо-пользователей их ещё нет)
create temporary table seed_listings (who text, country text, city text, cat text, sub text, title text, description text, price bigint, period text, whatsapp boolean, premium boolean, hours int) on commit drop;
insert into seed_listings values
 ('aibek', 'ru', 'moscow', 'work', 'vacancy', 'Разнорабочие на стройку, оплата каждую неделю', 'Нужны 5 человек на отделку жилого комплекса в Новой Москве. График 6/1, с 8:00 до 19:00. Обед и спецодежда за счёт компании. Патент обязателен, помогу с оформлением.', 3500, 'day', true, true, 2),
 ('nurgul', 'ru', 'moscow', 'housing', 'room', 'Койко-место для девушки у м. Текстильщики', 'Чистая квартира, живут три девушки из Кыргызстана. Всё есть: стиральная машина, wi-fi. Регистрация возможна. 7 минут пешком до метро.', 12000, 'month', true, false, 5),
 ('dilshod', 'ru', 'moscow', 'auto', 'ride', 'Такси в аэропорт Внуково и Домодедово', 'Встречу и провожу в любое время, помогу с багажом. Говорю на узбекском, русском и кыргызском. Машина Kia K5, некурящий салон.', 2500, null, true, false, 9),
 ('malika', 'ru', 'moscow', 'services', 'food', 'Домашний плов и самса на заказ', 'Готовлю плов по-ташкентски, самсу, манты и чучвару. Заказы от 5 порций. Доставка по ЮВАО бесплатно.', 450, null, true, true, 1),
 ('azamat', 'ru', 'moscow', 'services', 'repair', 'Электрик: проводка, розетки, люстры', 'Опыт 10 лет. Замена проводки, установка розеток, выключателей, люстр и счётчиков. Приеду в день обращения, свои инструменты.', 1500, 'hour', false, false, 20),
 ('aizhan', 'ru', 'moscow', 'services', 'beauty', 'Маникюр и педикюр на дому, недорого', 'Маникюр с покрытием гель-лаком, педикюр, наращивание. Стерильные инструменты. Работаю у себя на Выхино или выезжаю к вам.', 1200, null, true, false, 30),
 ('bekzod', 'ru', 'moscow', 'docs', 'translate', 'Перевод документов с нотариальным заверением', 'Перевожу паспорта, дипломы, свидетельства с узбекского, кыргызского и таджикского. Готово за 1 день, нотариус рядом с метро Курская.', 900, null, false, true, 26),
 ('zarina', 'ru', 'moscow', 'work', 'vacancy', 'Повар и помощник повара в кафе', 'Кафе национальной кухни ищет повара (лагман, плов, шашлык) и помощника. Питание, зарплата два раза в месяц, жильё рядом.', 70000, 'month', true, false, 40),
 ('aibek', 'ru', 'moscow', 'cargo', 'parcel', 'Посылки в Бишкек и Ош каждую неделю', 'Отправляю посылки авто-карго, срок 7–10 дней. Документы, одежда, техника. Забираю от метро.', 350, 'kg', true, false, 50),
 ('nurgul', 'ru', 'moscow', 'medical', 'clinic', 'Медсестра: уколы и капельницы на дому', 'Делаю уколы, капельницы, ставлю системы. Медицинское образование, опыт в больнице. ЮВАО и ЮАО.', 800, null, false, false, 60),
 ('dilshod', 'ru', 'moscow', 'goods', 'sell', 'Продаю iPhone 13, 128 ГБ, отличное состояние', 'Аккумулятор 88%, без царапин, есть коробка и чек. Причина продажи: купил новый.', 32000, null, true, false, 70),
 ('malika', 'ru', 'moscow', 'goods', 'home', 'Сухофрукты и орехи из Узбекистана', 'Курага, изюм, миндаль, грецкий орех. Свежий урожай, привезли на прошлой неделе. Опт и розница.', 900, 'kg', true, false, 80),
 ('azamat', 'ru', 'moscow', 'housing', 'flat', 'Сдаю 1-комнатную квартиру у м. Люблино', 'Квартира после ремонта, есть мебель и техника. Можно семейной паре. Залог 20 000.', 42000, 'month', false, true, 90),
 ('aizhan', 'ru', 'moscow', 'people', 'community', 'Землячество Иссык-Куля в Москве: встреча в субботу', 'Собираемся в кафе у м. Кузьминки, знакомимся и делимся опытом: работа, жильё, документы. Вход свободный.', null, null, true, false, 100),
 ('bekzod', 'ru', 'moscow', 'work', 'seek', 'Ищу работу: курьер или водитель категории B', 'Права РФ категории B, стаж 6 лет. Рассмотрю курьерскую доставку или работу водителем. Патент есть.', null, null, true, false, 110),
 ('zarina', 'ru', 'moscow', 'goods', 'free', 'Отдам детскую одежду на 2–4 года', 'Пакет детской одежды для мальчика: куртка, штаны, кофты. Всё чистое. Самовывоз от м. Марьино.', null, null, false, false, 120),
 ('aibek', 'ru', 'moscow', 'docs', 'permit', 'Помощь с патентом и регистрацией', 'Подскажу, как оформить патент, медкомиссию и регистрацию без посредников. Консультация бесплатно.', null, null, true, false, 130),
 ('dilshod', 'ru', 'moscow', 'auto', 'rent', 'Аренда авто под такси, Hyundai Solaris', 'Машина 2021 года, лицензия такси, ОСАГО. Посуточно, выходные по договорённости.', 2300, 'day', true, false, 140),
 ('nurgul', 'ru', 'spb', 'housing', 'room', 'Комната в Петербурге, м. Купчино', 'Светлая комната в двушке, соседи спокойные. Рядом магазины и рынок.', 18000, 'month', true, false, 15),
 ('azamat', 'ru', 'spb', 'work', 'vacancy', 'Склад: комплектовщики, вахта 30/15', 'Склад маркетплейса, проживание и питание бесплатно. Оплата от 85 000 за вахту.', 85000, 'month', true, false, 35),
 ('timur', 'us', 'nyc', 'cargo', 'parcel', 'Parcels New York → Bishkek, weekly', 'Посылки из Нью-Йорка в Бишкек авиа, 10–14 дней. Забираю в Бруклине и Квинсе.', 8, 'kg', true, true, 3),
 ('timur', 'us', 'nyc', 'housing', 'room', 'Room in Brooklyn, Sheepshead Bay', 'Комната в доме, 5 минут до поезда B/Q. Только для одного человека, без вредных привычек.', 900, 'month', true, false, 25),
 ('timur', 'us', 'nyc', 'work', 'vacancy', 'CDL drivers wanted, team routes', 'Нужны водители CDL-A, оплата за милю, помощь с получением прав.', 1800, 'week', true, false, 55),
 ('gulnara', 'kr', 'seoul', 'docs', 'permit', 'Помощь с визой E-9 и продлением', 'Помогаю заполнить документы на продление визы и сменить работодателя. Говорю на корейском.', 50000, null, true, true, 4),
 ('gulnara', 'kr', 'seoul', 'work', 'vacancy', 'Работа на заводе в Ансане', 'Завод автозапчастей, смены день/ночь. Общежитие есть. Нужна виза E-9 или H-2.', 2200000, 'month', true, false, 18),
 ('gulnara', 'kr', 'seoul', 'goods', 'home', 'Казы, курут и чай из Кыргызстана в Сеуле', 'Привозим продукты с родины раз в месяц. Доставка по Сеулу и Ансану.', 15000, 'kg', true, false, 44);

insert into public.listings (owner, country, city, cat, sub, title, description, price, period, phone, whatsapp, premium, views, created_at)
select p.id, l.country, l.city, l.cat, l.sub, l.title, l.description, l.price, l.period, p.phone, l.whatsapp, l.premium,
  (20 + (abs(hashtext(l.title)) % 400)), now() - l.hours * interval '1 hour'
from seed_listings l
join auth.users u on u.email = l.who || '.demo@migway.test'
join public.profiles p on p.id = u.id
where not exists (select 1 from public.listings x where x.owner = p.id and x.title = l.title);

-- у тестовой учётки: своё объявление, избранное, чаты
do $$
declare
  me uuid := (select id from auth.users where email = 'test@test.com');
  nurgul uuid := (select id from auth.users where email = 'nurgul.demo@migway.test');
  malika uuid := (select id from auth.users where email = 'malika.demo@migway.test');
  room uuid;
  c1 uuid;
  c2 uuid;
begin
  if not exists (select 1 from public.listings where owner = me) then
    insert into public.listings (owner, country, city, cat, sub, title, description, price, period, phone, whatsapp, views, created_at)
    values (me, 'ru', 'moscow', 'goods', 'sell', 'Продаю велосипед, почти новый', 'Горный велосипед, катался одно лето. Тестовое объявление для проверки приложения.', 9000, null, '+7 900 000-00-00', true, 37, now() - interval '6 hours');
  end if;

  insert into public.favorites (user_id, listing_id)
  select me, id from public.listings where premium and country = 'ru' and owner <> me
  on conflict do nothing;

  select id into room from public.listings where owner = nurgul and cat = 'housing' and city = 'moscow' limit 1;
  if room is not null and not exists (select 1 from public.chats where listing_id = room and me in (user_a, user_b)) then
    insert into public.chats (listing_id, user_a, user_b, kind) values (room, least(me, nurgul), greatest(me, nurgul), 'listing') returning id into c1;
    insert into public.messages (chat_id, sender, body, created_at) values
      (c1, me, 'Здравствуйте! Койко-место ещё свободно?', now() - interval '3 hours'),
      (c1, nurgul, 'Здравствуйте! Да, свободно. Когда хотите посмотреть?', now() - interval '2 hours 50 minutes'),
      (c1, nurgul, 'Можно сегодня после 18:00 или завтра в обед.', now() - interval '2 hours 49 minutes');
  end if;

  if not exists (select 1 from public.chats where kind = 'person' and user_a = least(me, malika) and user_b = greatest(me, malika)) then
    insert into public.chats (user_a, user_b, kind) values (least(me, malika), greatest(me, malika), 'person') returning id into c2;
    insert into public.messages (chat_id, sender, body, created_at) values
      (c2, malika, 'Привет! Увидела твой профиль в знакомствах 🙂', now() - interval '40 minutes'),
      (c2, me, 'Привет! Рад знакомству. Давно в Москве?', now() - interval '35 minutes'),
      (c2, malika, 'Второй год. Учусь и работаю в кофейне на Таганке ☕', now() - interval '30 minutes');
    insert into public.chat_reads (chat_id, user_id, read_at) values (c2, me, now() - interval '34 minutes');
  end if;

  insert into public.likes (user_id, person_id)
  select id, me from auth.users where email in ('malika.demo@migway.test', 'aizhan.demo@migway.test', 'nurgul.demo@migway.test')
  on conflict do nothing;
end $$;
