-- поля объявления по смыслу категории (график, залог, год выпуска и т.д.)
alter table public.listings add column if not exists attrs jsonb not null default '{}'::jsonb;
alter table public.listings drop constraint if exists listings_attrs_check;
alter table public.listings add constraint listings_attrs_check check (jsonb_typeof(attrs) = 'object' and pg_column_size(attrs) < 4000);
grant insert (attrs) on public.listings to authenticated;
grant update (attrs) on public.listings to authenticated;

-- поля для тестовых объявлений
update public.listings l set attrs = v.attrs::jsonb
from (values
  ('Разнорабочие на стройку, оплата каждую неделю', '{"schedule":["full"],"experience":"none","docs":["patent","any"],"food":true,"weekly":true,"place":"Новая Москва"}'),
  ('Койко-место для девушки у м. Текстильщики', '{"type":"bed","forWhom":"women","people":3,"deposit":5000,"registration":true,"utilities":true,"place":"м. Текстильщики"}'),
  ('Такси в аэропорт Внуково и Домодедово', '{"from":"Москва","to":"Внуково, Домодедово","seats":3}'),
  ('Домашний плов и самса на заказ', '{"cuisine":"uz","halal":true,"delivery":true,"place":"ЮВАО"}'),
  ('Электрик: проводка, розетки, люстры', '{"experience":"3","homeVisit":true,"tools":true,"place":"вся Москва"}'),
  ('Маникюр и педикюр на дому, недорого', '{"gender":"women","homeVisit":true,"place":"м. Выхино"}'),
  ('Перевод документов с нотариальным заверением', '{"langs":["uz","ky","tj","ru"],"notary":true,"days":1,"place":"м. Курская"}'),
  ('Повар и помощник повара в кафе', '{"schedule":["shift"],"experience":"1","docs":["patent","eaeu"],"housing":true,"food":true,"place":"м. Кузьминки"}'),
  ('Посылки в Бишкек и Ош каждую неделю', '{"from":"Москва","to":"Бишкек, Ош","days":10,"kind":"auto"}'),
  ('Медсестра: уколы и капельницы на дому', '{"langs":["ky","ru"],"homeVisit":true,"license":true,"place":"ЮВАО, ЮАО"}'),
  ('Продаю iPhone 13, 128 ГБ, отличное состояние', '{"condition":"used","place":"м. Марьино"}'),
  ('Сухофрукты и орехи из Узбекистана', '{"origin":"uz","delivery":true,"place":"Фуд Сити"}'),
  ('Сдаю 1-комнатную квартиру у м. Люблино', '{"rooms":"1","area":38,"floor":7,"deposit":20000,"forWhom":"family","furniture":true,"registration":true,"place":"м. Люблино"}'),
  ('Землячество Иссык-Куля в Москве: встреча в субботу', '{"date":"2026-11-28","time":"16:00","place":"м. Кузьминки"}'),
  ('Ищу работу: курьер или водитель категории B', '{"profession":"Курьер, водитель","experience":"3","schedule":["full","shift"],"docs":["patent","license"],"langs":["uz","ru"]}'),
  ('Отдам детскую одежду на 2–4 года', '{"place":"м. Марьино"}'),
  ('Помощь с патентом и регистрацией', '{"days":7,"langs":["ky","ru"],"place":"м. Садовод"}'),
  ('Аренда авто под такси, Hyundai Solaris', '{"model":"Hyundai Solaris 2021","deposit":15000,"taxiLicense":true,"place":"м. Котельники"}'),
  ('Комната в Петербурге, м. Купчино', '{"type":"room","forWhom":"any","people":2,"deposit":10000,"place":"м. Купчино"}'),
  ('Склад: комплектовщики, вахта 30/15', '{"schedule":["rotation"],"experience":"none","docs":["patent","eaeu"],"housing":true,"food":true,"place":"Шушары"}'),
  ('Parcels New York → Bishkek, weekly', '{"from":"New York","to":"Бишкек","days":12,"kind":"avia"}'),
  ('Room in Brooklyn, Sheepshead Bay', '{"type":"room","forWhom":"men","people":3,"deposit":900,"utilities":true,"place":"Sheepshead Bay"}'),
  ('CDL drivers wanted, team routes', '{"schedule":["rotation"],"experience":"1","place":"Brooklyn"}'),
  ('Помощь с визой E-9 и продлением', '{"days":14,"langs":["ky","ru","ko"],"place":"Ансан"}'),
  ('Работа на заводе в Ансане', '{"schedule":["shift"],"experience":"none","housing":true,"food":true,"place":"Ансан"}'),
  ('Казы, курут и чай из Кыргызстана в Сеуле', '{"origin":"kg","delivery":true,"place":"Сеул, Ансан"}'),
  ('Продаю велосипед, почти новый', '{"condition":"used","place":"м. Текстильщики"}')
) as v(title, attrs)
where l.title = v.title and l.attrs = '{}'::jsonb;
