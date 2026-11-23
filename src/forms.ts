import type { Period } from './data'

// Поля объявления по смыслу категории. Значения хранятся в listings.attrs (jsonb).
type L4 = [string, string, string, string]

export interface Option {
  id: string
  name: L4
}

export interface FieldDef {
  key: string
  kind: 'text' | 'number' | 'select' | 'chips' | 'bool' | 'date'
  label: L4
  options?: Option[]
  hint?: L4
  unit?: L4
  max?: number
  half?: boolean // поле в половину ширины (два в ряд)
  money?: boolean // сумма в валюте страны
}

export interface FormSpec {
  price: 'none' | 'price' | 'salary' | 'budget' | 'free'
  periods: Period[] // первое значение по умолчанию; пусто = цена без периода
  priceOptional?: boolean // «договорная», если пусто
  titleHint: L4
  descHint: L4
  fields: FieldDef[]
}

const o = (id: string, ru: string, en: string, ky: string, uz: string): Option => ({ id, name: [ru, en, ky, uz] })

/* ---------- общие поля ---------- */

const metro: FieldDef = { key: 'place', kind: 'text', label: ['Район или метро', 'Area or subway', 'Район же метро', 'Tuman yoki metro'], hint: ['Например: м. Текстильщики', 'E.g. Brooklyn, Sheepshead Bay', 'Мисалы: Текстильщики метросу', 'Masalan: Tekstilshiki metrosi'], max: 60 }
const schedule: FieldDef = {
  key: 'schedule', kind: 'chips', label: ['График', 'Schedule', 'График', 'Jadval'],
  options: [o('full', 'Полный день', 'Full day', 'Толук күн', 'Toʻliq kun'), o('shift', 'Сменный', 'Shifts', 'Сменалык', 'Smenali'), o('rotation', 'Вахта', 'Rotation', 'Вахта', 'Vaxta'), o('part', 'Подработка', 'Part-time', 'Кошумча иш', 'Qoʻshimcha ish')],
}
const experience: FieldDef = {
  key: 'experience', kind: 'chips', label: ['Опыт', 'Experience', 'Тажрыйба', 'Tajriba'],
  options: [o('none', 'Без опыта', 'No experience', 'Тажрыйбасыз', 'Tajribasiz'), o('1', 'От 1 года', '1+ year', '1 жылдан', '1 yildan'), o('3', 'От 3 лет', '3+ years', '3 жылдан', '3 yildan')],
}
const docsNeeded: FieldDef = {
  key: 'docs', kind: 'chips', label: ['Документы', 'Documents', 'Документтер', 'Hujjatlar'],
  options: [o('patent', 'Патент', 'Work permit', 'Патент', 'Patent'), o('eaeu', 'Граждане ЕАЭС', 'EAEU citizens', 'ЕАЭБ жарандары', 'YeOII fuqarolari'), o('any', 'Помогу оформить', 'Will help', 'Жардам берем', 'Yordam beraman')],
}
const homeVisit: FieldDef = { key: 'homeVisit', kind: 'bool', label: ['Выезд на дом', 'Home visits', 'Үйгө барам', 'Uyga boraman'] }
const langs: FieldDef = {
  key: 'langs', kind: 'chips', label: ['Языки', 'Languages', 'Тилдер', 'Tillar'],
  options: [o('ru', 'Русский', 'Russian', 'Орусча', 'Ruscha'), o('ky', 'Кыргызский', 'Kyrgyz', 'Кыргызча', 'Qirgʻizcha'), o('uz', 'Узбекский', 'Uzbek', 'Өзбекче', 'Oʻzbekcha'), o('tj', 'Таджикский', 'Tajik', 'Тажикче', 'Tojikcha'), o('en', 'Английский', 'English', 'Англисче', 'Inglizcha'), o('ko', 'Корейский', 'Korean', 'Корейче', 'Koreyscha')],
}
const condition: FieldDef = {
  key: 'condition', kind: 'chips', label: ['Состояние', 'Condition', 'Абалы', 'Holati'],
  options: [o('new', 'Новое', 'New', 'Жаңы', 'Yangi'), o('used', 'Б/у', 'Used', 'Колдонулган', 'Ishlatilgan')],
}
const delivery: FieldDef = { key: 'delivery', kind: 'bool', label: ['Есть доставка', 'Delivery available', 'Жеткирүү бар', 'Yetkazib berish bor'] }
const from: FieldDef = { key: 'from', kind: 'text', label: ['Откуда', 'From', 'Каяктан', 'Qayerdan'], max: 40, half: true }
const to: FieldDef = { key: 'to', kind: 'text', label: ['Куда', 'To', 'Кайда', 'Qayerga'], max: 40, half: true }
const date: FieldDef = { key: 'date', kind: 'date', label: ['Дата', 'Date', 'Күнү', 'Sana'], half: true }
const forWhom: FieldDef = {
  key: 'forWhom', kind: 'chips', label: ['Для кого', 'For whom', 'Ким үчүн', 'Kim uchun'],
  options: [o('men', 'Мужчинам', 'Men', 'Эркектерге', 'Erkaklarga'), o('women', 'Женщинам', 'Women', 'Аялдарга', 'Ayollarga'), o('family', 'Семье', 'Family', 'Үй-бүлөгө', 'Oilaga'), o('any', 'Всем', 'Anyone', 'Баарына', 'Hammaga')],
}

/* ---------- спецификации ---------- */

const generic: FormSpec = {
  price: 'price', periods: [], priceOptional: true,
  titleHint: ['Коротко, что предлагаете', 'What are you offering', 'Эмне сунуштайсыз', 'Nima taklif qilasiz'],
  descHint: ['Подробности, условия, для кого', 'Details, conditions, who it is for', 'Толук маалымат, шарттар', 'Batafsil, shartlar, kim uchun'],
  fields: [metro],
}

const SPECS: Record<string, FormSpec> = {
  'work/vacancy': {
    price: 'salary', periods: ['month', 'week', 'day', 'hour'], priceOptional: true,
    titleHint: ['Должность: например, Разнорабочий на стройку', 'Position: e.g. Construction worker', 'Кызмат: мисалы, Курулушка жумушчу', 'Lavozim: masalan, Qurilish ishchisi'],
    descHint: ['Обязанности, условия, адрес объекта', 'Duties, conditions, address', 'Милдеттер, шарттар, дареги', 'Vazifalar, shartlar, manzil'],
    fields: [schedule, experience, docsNeeded,
      { key: 'housing', kind: 'bool', label: ['Предоставляем жильё', 'Housing provided', 'Турак жай беребиз', 'Turar joy beriladi'] },
      { key: 'food', kind: 'bool', label: ['Питание', 'Meals provided', 'Тамак берилет', 'Ovqat beriladi'] },
      { key: 'weekly', kind: 'bool', label: ['Оплата каждую неделю', 'Paid weekly', 'Ар жумада төлөм', 'Har hafta toʻlov'] },
      metro],
  },
  'work/seek': {
    price: 'salary', periods: ['month', 'day', 'hour'], priceOptional: true,
    titleHint: ['Кем хотите работать', 'What job are you looking for', 'Ким болуп иштегиңиз келет', 'Kim boʻlib ishlamoqchisiz'],
    descHint: ['Опыт, навыки, когда готовы выйти', 'Experience, skills, when you can start', 'Тажрыйба, көндүмдөр', 'Tajriba, koʻnikmalar'],
    fields: [
      { key: 'profession', kind: 'text', label: ['Профессия', 'Profession', 'Кесип', 'Kasb'], hint: ['Например: сварщик, повар, водитель', 'E.g. welder, cook, driver', 'Мисалы: ширетүүчү, ашпозчу', 'Masalan: payvandchi, oshpaz'], max: 60 },
      experience,
      schedule,
      { key: 'docs', kind: 'chips', label: ['Документы', 'Documents', 'Документтер', 'Hujjatlar'], options: [o('patent', 'Есть патент', 'Have permit', 'Патентим бар', 'Patentim bor'), o('eaeu', 'Гражданин ЕАЭС', 'EAEU citizen', 'ЕАЭБ жараны', 'YeOII fuqarosi'), o('license', 'Права B/C', 'Driver license', 'Айдоочулук күбөлүк', 'Haydovchilik guvohnomasi')] },
      langs],
  },
  'housing/room': {
    price: 'price', periods: ['month', 'day', 'week'],
    titleHint: ['Например: Койко-место у м. Текстильщики', 'E.g. Bed in a shared room near subway', 'Мисалы: Метронун жанында орун', 'Masalan: Metro yonida joy'],
    descHint: ['Кто живёт, что есть в квартире, правила', 'Who lives there, amenities, rules', 'Ким жашайт, эмнелер бар', 'Kim yashaydi, nimalar bor'],
    fields: [
      { key: 'type', kind: 'chips', label: ['Тип', 'Type', 'Түрү', 'Turi'], options: [o('bed', 'Койко-место', 'Bed', 'Орун', 'Joy'), o('room', 'Комната', 'Room', 'Бөлмө', 'Xona')] },
      forWhom,
      { key: 'people', kind: 'number', label: ['Живёт человек', 'People living', 'Жашаган адам', 'Yashovchilar'], max: 30, half: true },
      { key: 'deposit', kind: 'number', label: ['Залог', 'Deposit', 'Күрөө', 'Garov'], half: true, money: true },
      { key: 'registration', kind: 'bool', label: ['Можно с регистрацией', 'Registration possible', 'Каттоо мүмкүн', 'Roʻyxatdan oʻtish mumkin'] },
      { key: 'utilities', kind: 'bool', label: ['Коммуналка включена', 'Utilities included', 'Коммуналдык кирет', 'Kommunal kiritilgan'] },
      metro],
  },
  'housing/flat': {
    price: 'price', periods: ['month', 'day'],
    titleHint: ['Например: 1-комнатная у м. Люблино', 'E.g. 1-bedroom near subway', 'Мисалы: 1 бөлмөлүү батир', 'Masalan: 1 xonali kvartira'],
    descHint: ['Ремонт, мебель, техника, условия', 'Renovation, furniture, terms', 'Ремонт, эмерек, шарттар', 'Taʼmir, mebel, shartlar'],
    fields: [
      { key: 'rooms', kind: 'chips', label: ['Комнат', 'Rooms', 'Бөлмөлөр', 'Xonalar'], options: [o('studio', 'Студия', 'Studio', 'Студия', 'Studiya'), o('1', '1', '1', '1', '1'), o('2', '2', '2', '2', '2'), o('3', '3+', '3+', '3+', '3+')] },
      { key: 'area', kind: 'number', label: ['Площадь', 'Area', 'Аянты', 'Maydoni'], unit: ['м²', 'm²', 'м²', 'm²'], max: 1000, half: true },
      { key: 'floor', kind: 'number', label: ['Этаж', 'Floor', 'Кабат', 'Qavat'], max: 100, half: true },
      { key: 'deposit', kind: 'number', label: ['Залог', 'Deposit', 'Күрөө', 'Garov'], half: true, money: true },
      forWhom,
      { key: 'furniture', kind: 'bool', label: ['С мебелью', 'Furnished', 'Эмереги менен', 'Mebelli'] },
      { key: 'registration', kind: 'bool', label: ['Можно с регистрацией', 'Registration possible', 'Каттоо мүмкүн', 'Roʻyxatdan oʻtish mumkin'] },
      metro],
  },
  'housing/seek': {
    price: 'budget', periods: ['month', 'day'], priceOptional: true,
    titleHint: ['Например: Сниму комнату на двоих', 'E.g. Looking for a room for two', 'Мисалы: Экөөбүзгө бөлмө ижарага алам', 'Masalan: Ikki kishiga xona'],
    descHint: ['Кто будет жить, с какого числа, пожелания', 'Who will live, from when, wishes', 'Ким жашайт, качантан', 'Kim yashaydi, qachondan'],
    fields: [
      { key: 'type', kind: 'chips', label: ['Что ищу', 'Looking for', 'Эмне издейм', 'Nima qidiryapman'], options: [o('bed', 'Койко-место', 'Bed', 'Орун', 'Joy'), o('room', 'Комната', 'Room', 'Бөлмө', 'Xona'), o('flat', 'Квартира', 'Apartment', 'Батир', 'Kvartira')] },
      { key: 'people', kind: 'number', label: ['Сколько человек', 'How many people', 'Канча адам', 'Necha kishi'], max: 20, half: true },
      { key: 'date', kind: 'date', label: ['Заезд с', 'Move in from', 'Качантан', 'Qachondan'], half: true },
      metro],
  },
  'services/repair': {
    price: 'price', periods: ['hour', 'day'], priceOptional: true,
    titleHint: ['Например: Электрик, сантехник, отделка', 'E.g. Electrician, plumber', 'Мисалы: Электрик, сантехник', 'Masalan: Elektrik, santexnik'],
    descHint: ['Какие работы делаете, опыт, инструмент', 'What you do, experience, tools', 'Кандай иштерди жасайсыз', 'Qanday ishlar qilasiz'],
    fields: [experience, homeVisit, { key: 'tools', kind: 'bool', label: ['Свой инструмент', 'Own tools', 'Өз аспаптарым', 'Oʻz asboblarim'] }, metro],
  },
  'services/beauty': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Маникюр, стрижка, макияж', 'E.g. Manicure, haircut', 'Мисалы: Маникюр, чач кыркуу', 'Masalan: Manikyur, soch olish'],
    descHint: ['Услуги, материалы, где принимаете', 'Services, materials, location', 'Кызматтар, кайда кабыл аласыз', 'Xizmatlar, qayerda qabul qilasiz'],
    fields: [{ key: 'gender', kind: 'chips', label: ['Для кого', 'For whom', 'Ким үчүн', 'Kim uchun'], options: [o('women', 'Женщинам', 'Women', 'Аялдарга', 'Ayollarga'), o('men', 'Мужчинам', 'Men', 'Эркектерге', 'Erkaklarga'), o('any', 'Всем', 'Anyone', 'Баарына', 'Hammaga')] }, homeVisit, metro],
  },
  'services/food': {
    price: 'price', periods: ['kg'], priceOptional: true,
    titleHint: ['Например: Домашний плов и самса', 'E.g. Homemade plov and samsa', 'Мисалы: Үй палоосу жана самса', 'Masalan: Uy palovi va somsa'],
    descHint: ['Меню, минимальный заказ, сроки', 'Menu, minimum order, timing', 'Меню, минималдуу буйрутма', 'Menyu, eng kam buyurtma'],
    fields: [{ key: 'cuisine', kind: 'chips', label: ['Кухня', 'Cuisine', 'Ашкана', 'Oshxona'], options: [o('kg', 'Кыргызская', 'Kyrgyz', 'Кыргыз', 'Qirgʻiz'), o('uz', 'Узбекская', 'Uzbek', 'Өзбек', 'Oʻzbek'), o('tj', 'Таджикская', 'Tajik', 'Тажик', 'Tojik'), o('other', 'Другая', 'Other', 'Башка', 'Boshqa')] }, { key: 'halal', kind: 'bool', label: ['Халяль', 'Halal', 'Халал', 'Halol'] }, delivery, metro],
  },
  'services/lessons': {
    price: 'price', periods: ['hour'], priceOptional: true,
    titleHint: ['Например: Русский язык для экзамена на патент', 'E.g. Russian for the permit exam', 'Мисалы: Патент үчүн орус тили', 'Masalan: Patent uchun rus tili'],
    descHint: ['Чему учите, формат, опыт', 'What you teach, format, experience', 'Эмнеге үйрөтөсүз', 'Nimaga oʻrgatasiz'],
    fields: [{ key: 'format', kind: 'chips', label: ['Формат', 'Format', 'Формат', 'Format'], options: [o('online', 'Онлайн', 'Online', 'Онлайн', 'Onlayn'), o('offline', 'Очно', 'In person', 'Жолугуп', 'Yuzma-yuz')] }, langs, metro],
  },
  'medical/clinic': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Терапевт, говорю на кыргызском', 'E.g. GP who speaks Kyrgyz', 'Мисалы: Терапевт, кыргызча сүйлөйм', 'Masalan: Terapevt, oʻzbekcha gapiraman'],
    descHint: ['Специальность, адрес, часы приёма', 'Specialty, address, hours', 'Адиси, дареги, убактысы', 'Mutaxassislik, manzil, vaqt'],
    fields: [langs, homeVisit, { key: 'license', kind: 'bool', label: ['Есть лицензия', 'Licensed', 'Лицензиясы бар', 'Litsenziya bor'] }, metro],
  },
  'medical/dentist': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Лечение и чистка зубов', 'E.g. Dental treatment and cleaning', 'Мисалы: Тиш дарылоо', 'Masalan: Tish davolash'],
    descHint: ['Услуги и цены, адрес, часы приёма', 'Services and prices, address, hours', 'Кызматтар, дареги', 'Xizmatlar, manzil'],
    fields: [langs, { key: 'license', kind: 'bool', label: ['Есть лицензия', 'Licensed', 'Лицензиясы бар', 'Litsenziya bor'] }, metro],
  },
  'medical/meds': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Какое лекарство', 'Which medicine', 'Кайсы дары', 'Qaysi dori'],
    descHint: ['Название, срок годности, откуда привезено', 'Name, expiry date, origin', 'Аты, жарактуулук мөөнөтү', 'Nomi, yaroqlilik muddati'],
    fields: [{ key: 'expires', kind: 'date', label: ['Годен до', 'Expires', 'Жарактуу', 'Yaroqli'], half: true }, delivery, metro],
  },
  'docs/permit': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Помощь с патентом и регистрацией', 'E.g. Help with permit and registration', 'Мисалы: Патент алууга жардам', 'Masalan: Patent olishda yordam'],
    descHint: ['Что оформляете, сроки, что нужно от клиента', 'What you arrange, timing, requirements', 'Эмне жасайсыз, мөөнөтү', 'Nima qilasiz, muddati'],
    fields: [{ key: 'days', kind: 'number', label: ['Срок', 'Takes', 'Мөөнөтү', 'Muddati'], unit: ['дней', 'days', 'күн', 'kun'], max: 365, half: true }, langs, metro],
  },
  'docs/lawyer': {
    price: 'price', periods: ['hour'], priceOptional: true,
    titleHint: ['Например: Юрист по миграционным делам', 'E.g. Immigration lawyer', 'Мисалы: Миграция боюнча юрист', 'Masalan: Migratsiya yuristi'],
    descHint: ['С какими вопросами помогаете, опыт', 'Cases you handle, experience', 'Кандай маселелер', 'Qanday masalalar'],
    fields: [{ key: 'firstFree', kind: 'bool', label: ['Первая консультация бесплатно', 'First consultation free', 'Биринчи кеңеш акысыз', 'Birinchi maslahat bepul'] }, langs, metro],
  },
  'docs/translate': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Перевод паспорта с нотариусом', 'E.g. Certified passport translation', 'Мисалы: Паспортту которуу', 'Masalan: Pasport tarjimasi'],
    descHint: ['Какие документы, сроки, заверение', 'Documents, timing, certification', 'Кандай документтер, мөөнөтү', 'Qanday hujjatlar, muddati'],
    fields: [langs, { key: 'notary', kind: 'bool', label: ['Нотариальное заверение', 'Notarized', 'Нотариус күбөлөндүрөт', 'Notarial tasdiq'] }, { key: 'days', kind: 'number', label: ['Срок', 'Takes', 'Мөөнөтү', 'Muddati'], unit: ['дней', 'days', 'күн', 'kun'], max: 60, half: true }, metro],
  },
  'auto/sell': {
    price: 'price', periods: [],
    titleHint: ['Марка и модель, например: Hyundai Solaris', 'Make and model, e.g. Toyota Camry', 'Маркасы, мисалы: Hyundai Solaris', 'Markasi, masalan: Chevrolet Cobalt'],
    descHint: ['Состояние, история, комплектация', 'Condition, history, trim', 'Абалы, тарыхы', 'Holati, tarixi'],
    fields: [
      { key: 'year', kind: 'number', label: ['Год выпуска', 'Year', 'Чыккан жылы', 'Yili'], max: 2030, half: true },
      { key: 'mileage', kind: 'number', label: ['Пробег', 'Mileage', 'Жүрүшү', 'Yurgani'], unit: ['км', 'km', 'км', 'km'], half: true },
      { key: 'gearbox', kind: 'chips', label: ['Коробка', 'Transmission', 'Кутусу', 'Uzatmalar qutisi'], options: [o('auto', 'Автомат', 'Automatic', 'Автомат', 'Avtomat'), o('manual', 'Механика', 'Manual', 'Механика', 'Mexanika')] },
      { key: 'fuel', kind: 'chips', label: ['Топливо', 'Fuel', 'Күйүүчү май', 'Yoqilgʻi'], options: [o('petrol', 'Бензин', 'Petrol', 'Бензин', 'Benzin'), o('diesel', 'Дизель', 'Diesel', 'Дизель', 'Dizel'), o('gas', 'Газ', 'Gas', 'Газ', 'Gaz'), o('hybrid', 'Гибрид', 'Hybrid', 'Гибрид', 'Gibrid')] },
      metro],
  },
  'auto/rent': {
    price: 'price', periods: ['day', 'week', 'month'],
    titleHint: ['Например: Аренда авто под такси', 'E.g. Car rental for taxi', 'Мисалы: Таксиге унаа ижарасы', 'Masalan: Taksi uchun avto ijarasi'],
    descHint: ['Машина, условия, что нужно от водителя', 'Car, terms, driver requirements', 'Унаа, шарттар', 'Mashina, shartlar'],
    fields: [
      { key: 'model', kind: 'text', label: ['Машина', 'Car', 'Унаа', 'Mashina'], hint: ['Например: Kia Rio 2021', 'E.g. Toyota Prius 2020', 'Мисалы: Kia Rio 2021', 'Masalan: Kia Rio 2021'], max: 40 },
      { key: 'deposit', kind: 'number', label: ['Залог', 'Deposit', 'Күрөө', 'Garov'], half: true, money: true },
      { key: 'taxiLicense', kind: 'bool', label: ['Есть лицензия такси', 'Taxi license', 'Такси лицензиясы бар', 'Taksi litsenziyasi bor'] },
      metro],
  },
  'auto/ride': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Москва → Бишкек, есть 3 места', 'E.g. Airport transfer', 'Мисалы: Москва → Бишкек', 'Masalan: Moskva → Toshkent'],
    descHint: ['Машина, багаж, где забираете', 'Car, luggage, pickup', 'Унаа, жүк, кайдан аласыз', 'Mashina, yuk, qayerdan olasiz'],
    fields: [from, to, date, { key: 'seats', kind: 'number', label: ['Свободных мест', 'Free seats', 'Бош орун', 'Boʻsh joy'], max: 50, half: true }],
  },
  'cargo/parcel': {
    price: 'price', periods: ['kg'],
    titleHint: ['Например: Посылки в Бишкек и Ош каждую неделю', 'E.g. Weekly parcels to Bishkek', 'Мисалы: Бишкекке посылка', 'Masalan: Toshkentga posilka'],
    descHint: ['Что принимаете, где забираете, как отслеживать', 'What you accept, pickup, tracking', 'Эмне кабыл аласыз', 'Nima qabul qilasiz'],
    fields: [from, to, { key: 'days', kind: 'number', label: ['Доставка за', 'Delivery in', 'Жеткирүү', 'Yetkazish'], unit: ['дней', 'days', 'күн', 'kun'], max: 90, half: true }, { key: 'kind', kind: 'chips', label: ['Способ', 'Method', 'Ыкмасы', 'Usuli'], options: [o('avia', 'Авиа', 'Air', 'Авиа', 'Avia'), o('auto', 'Авто', 'Truck', 'Авто', 'Avto'), o('train', 'Поезд', 'Train', 'Поезд', 'Poyezd')] }],
  },
  'cargo/moving': {
    price: 'price', periods: ['hour'], priceOptional: true,
    titleHint: ['Например: Грузчики и газель, переезды', 'E.g. Movers with a van', 'Мисалы: Жүк ташуучулар', 'Masalan: Yuk tashuvchilar'],
    descHint: ['Машина, сколько грузчиков, районы', 'Vehicle, movers, areas', 'Унаа, канча жүк ташуучу', 'Mashina, nechta yuk tashuvchi'],
    fields: [{ key: 'movers', kind: 'number', label: ['Грузчиков', 'Movers', 'Жүк ташуучу', 'Yuk tashuvchi'], max: 50, half: true }, { key: 'truck', kind: 'bool', label: ['Есть машина', 'Have a truck', 'Унаа бар', 'Mashina bor'] }, metro],
  },
  'cargo/tickets': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Например: Билеты Москва → Ош недорого', 'E.g. Cheap flights to Bishkek', 'Мисалы: Арзан авиабилеттер', 'Masalan: Arzon aviachiptalar'],
    descHint: ['Направления, авиакомпании, как оформить', 'Routes, airlines, how to book', 'Багыттар, авиакомпаниялар', 'Yoʻnalishlar, aviakompaniyalar'],
    fields: [from, to, date],
  },
  'goods/sell': {
    price: 'price', periods: [], priceOptional: true,
    titleHint: ['Что продаёте, например: iPhone 13, 128 ГБ', 'What are you selling', 'Эмне сатасыз', 'Nima sotasiz'],
    descHint: ['Состояние, комплект, причина продажи', 'Condition, what is included', 'Абалы, комплекти', 'Holati, toʻplami'],
    fields: [condition, delivery, metro],
  },
  'goods/home': {
    price: 'price', periods: ['kg'], priceOptional: true,
    titleHint: ['Например: Курут, казы, сухофрукты', 'E.g. Kurut, kazy, dried fruit', 'Мисалы: Курут, казы', 'Masalan: Qurt, qazi, quruq meva'],
    descHint: ['Что привезли, откуда, опт или розница', 'What, from where, wholesale or retail', 'Эмне алып келдиңер, каяктан', 'Nima olib keldingiz, qayerdan'],
    fields: [{ key: 'origin', kind: 'chips', label: ['Откуда', 'Origin', 'Каяктан', 'Qayerdan'], options: [o('kg', 'Кыргызстан', 'Kyrgyzstan', 'Кыргызстан', 'Qirgʻiziston'), o('uz', 'Узбекистан', 'Uzbekistan', 'Өзбекстан', 'Oʻzbekiston'), o('tj', 'Таджикистан', 'Tajikistan', 'Тажикстан', 'Tojikiston'), o('kz', 'Казахстан', 'Kazakhstan', 'Казакстан', 'Qozogʻiston')] }, delivery, metro],
  },
  'goods/free': {
    price: 'free', periods: [],
    titleHint: ['Что отдаёте, например: Детская одежда', 'What are you giving away', 'Эмне бересиз', 'Nima berasiz'],
    descHint: ['Состояние, когда и где забрать', 'Condition, pickup time and place', 'Абалы, качан алып кетсе болот', 'Holati, qachon olib ketish mumkin'],
    fields: [metro],
  },
  'people/dating': {
    price: 'none', periods: [],
    titleHint: ['Пару слов о себе', 'A few words about you', 'Өзүңүз жөнүндө', 'Oʻzingiz haqingizda'],
    descHint: ['Кого ищете, интересы', 'Who you are looking for, interests', 'Кимди издейсиз', 'Kimni qidirasiz'],
    fields: [{ key: 'age', kind: 'number', label: ['Возраст', 'Age', 'Жашы', 'Yoshi'], max: 99, half: true }, { key: 'from', kind: 'text', label: ['Откуда родом', 'Hometown', 'Кайсы жерден', 'Qayerdan'], max: 40, half: true }],
  },
  'people/community': {
    price: 'none', periods: [],
    titleHint: ['Например: Встреча земляков в субботу', 'E.g. Community meetup on Saturday', 'Мисалы: Жердештердин жолугушуусу', 'Masalan: Hamyurtlar uchrashuvi'],
    descHint: ['Где, когда, для кого', 'Where, when, who for', 'Кайда, качан', 'Qayerda, qachon'],
    fields: [date, { key: 'time', kind: 'text', label: ['Время', 'Time', 'Убактысы', 'Vaqti'], hint: ['18:00', '6 pm', '18:00', '18:00'], max: 20, half: true }, metro],
  },
}

export function specOf(cat: string, sub: string): FormSpec {
  return SPECS[`${cat}/${sub}`] ?? generic
}

export const PRICE_LABEL: Record<FormSpec['price'], L4> = {
  none: ['', '', '', ''],
  price: ['Цена', 'Price', 'Баасы', 'Narxi'],
  salary: ['Зарплата', 'Salary', 'Айлык', 'Maosh'],
  budget: ['Бюджет', 'Budget', 'Бюджет', 'Byudjet'],
  free: ['', '', '', ''],
}

export const NEGOTIABLE: L4 = ['Договорная', 'Negotiable', 'Келишим боюнча', 'Kelishilgan']
export const YES: L4 = ['Да', 'Yes', 'Ооба', 'Ha']

export type Attrs = Record<string, string | number | boolean | string[]>

// подписи для карточки объявления: [label, value]
export function describeAttrs(cat: string, sub: string, attrs: Attrs, li: number, currency = ''): [string, string][] {
  const out: [string, string][] = []
  for (const f of specOf(cat, sub).fields) {
    const v = attrs[f.key]
    if (v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0)) continue
    let text: string
    if (f.kind === 'bool') text = YES[li]
    else if (f.kind === 'chips') {
      const ids = Array.isArray(v) ? v : [String(v)]
      text = ids.map((id) => f.options?.find((op) => op.id === id)?.name[li] ?? id).join(', ')
    } else if (f.kind === 'date') {
      const d = new Date(String(v))
      text = isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(['ru-RU', 'en-US', 'ru-RU', 'uz-UZ'][li], { day: 'numeric', month: 'long' })
    } else if (f.kind === 'number') text = `${Number(v).toLocaleString('ru-RU')}${f.unit ? ' ' + f.unit[li] : ''}${f.money && currency ? ' ' + currency : ''}`
    else text = String(v)
    out.push([f.label[li], text])
  }
  return out
}

// поля с несколькими значениями
export const MULTI = new Set(['langs', 'docs', 'schedule'])
