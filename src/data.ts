type L4 = [string, string, string, string]

export type CountryId = 'ru' | 'us' | 'kr'
export type Currency = 'RUB' | 'USD' | 'KRW'
export type Period = 'month' | 'day' | 'hour' | 'week' | 'kg'

export interface City {
  id: string
  name: L4
}

export interface Country {
  id: CountryId
  flag: string
  name: L4
  currency: Currency
  phonePrefix: string
  cities: City[]
}

export const COUNTRIES: Country[] = [
  {
    id: 'ru',
    flag: '🇷🇺',
    name: ['Россия', 'Russia', 'Россия', 'Rossiya'],
    currency: 'RUB',
    phonePrefix: '+7',
    cities: [
      { id: 'moscow', name: ['Москва', 'Moscow', 'Москва', 'Moskva'] },
      { id: 'spb', name: ['Санкт-Петербург', 'Saint Petersburg', 'Санкт-Петербург', 'Sankt-Peterburg'] },
      { id: 'ekb', name: ['Екатеринбург', 'Yekaterinburg', 'Екатеринбург', 'Yekaterinburg'] },
      { id: 'nsk', name: ['Новосибирск', 'Novosibirsk', 'Новосибирск', 'Novosibirsk'] },
      { id: 'kazan', name: ['Казань', 'Kazan', 'Казань', 'Qozon'] },
    ],
  },
  {
    id: 'us',
    flag: '🇺🇸',
    name: ['США', 'USA', 'АКШ', 'AQSH'],
    currency: 'USD',
    phonePrefix: '+1',
    cities: [
      { id: 'nyc', name: ['Нью-Йорк', 'New York', 'Нью-Йорк', 'Nyu-York'] },
      { id: 'chicago', name: ['Чикаго', 'Chicago', 'Чикаго', 'Chikago'] },
      { id: 'philly', name: ['Филадельфия', 'Philadelphia', 'Филадельфия', 'Filadelfiya'] },
      { id: 'la', name: ['Лос-Анджелес', 'Los Angeles', 'Лос-Анджелес', 'Los-Anjeles'] },
      { id: 'seattle', name: ['Сиэтл', 'Seattle', 'Сиэтл', 'Sietl'] },
    ],
  },
  {
    id: 'kr',
    flag: '🇰🇷',
    name: ['Корея', 'South Korea', 'Корея', 'Koreya'],
    currency: 'KRW',
    phonePrefix: '+82',
    cities: [
      { id: 'seoul', name: ['Сеул', 'Seoul', 'Сеул', 'Seul'] },
      { id: 'ansan', name: ['Ансан', 'Ansan', 'Ансан', 'Ansan'] },
      { id: 'incheon', name: ['Инчхон', 'Incheon', 'Инчхон', 'Inchxon'] },
      { id: 'hwaseong', name: ['Хвасон', 'Hwaseong', 'Хвасон', 'Xvason'] },
      { id: 'busan', name: ['Пусан', 'Busan', 'Пусан', 'Pusan'] },
    ],
  },
]

export interface Sub {
  id: string
  name: L4
}

export interface Category {
  id: string
  emoji: string
  icon: string
  color: string
  name: L4
  subs: Sub[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'work', emoji: '💼', icon: 'briefcase', color: '#dfeaf3', name: ['Работа', 'Jobs', 'Жумуш', 'Ish'],
    subs: [
      { id: 'vacancy', name: ['Вакансии', 'Vacancies', 'Жумуш орундары', 'Vakansiyalar'] },
      { id: 'seek', name: ['Ищу работу', 'Looking for work', 'Жумуш издейм', 'Ish qidiryapman'] },
    ],
  },
  {
    id: 'housing', emoji: '🏠', icon: 'home', color: '#dcefe7', name: ['Жильё', 'Housing', 'Турак жай', 'Uy-joy'],
    subs: [
      { id: 'room', name: ['Комнаты, койко-места', 'Rooms & beds', 'Бөлмө, орун', 'Xona, joy'] },
      { id: 'flat', name: ['Квартиры', 'Apartments', 'Батирлер', 'Kvartiralar'] },
      { id: 'seek', name: ['Сниму', 'Looking to rent', 'Ижарага алам', 'Ijaraga olaman'] },
    ],
  },
  {
    id: 'services', emoji: '🛠️', icon: 'wrench', color: '#f6ecd6', name: ['Услуги', 'Services', 'Кызматтар', 'Xizmatlar'],
    subs: [
      { id: 'repair', name: ['Ремонт', 'Repair', 'Оңдоо', 'Taʼmirlash'] },
      { id: 'beauty', name: ['Красота', 'Beauty', 'Сулуулук', 'Goʻzallik'] },
      { id: 'food', name: ['Еда на заказ', 'Home food', 'Тамак буйрутма', 'Buyurtma taomlar'] },
      { id: 'lessons', name: ['Обучение', 'Lessons', 'Окутуу', 'Taʼlim'] },
    ],
  },
  {
    id: 'medical', emoji: '🩺', icon: 'medical', color: '#f6e1de', name: ['Медицина', 'Medical', 'Медицина', 'Tibbiyot'],
    subs: [
      { id: 'clinic', name: ['Клиники и врачи', 'Clinics & doctors', 'Клиника, дарыгер', 'Klinika, shifokor'] },
      { id: 'dentist', name: ['Стоматология', 'Dentists', 'Стоматология', 'Stomatologiya'] },
      { id: 'meds', name: ['Лекарства с родины', 'Medicine from home', 'Мекенден дары', 'Vatandan dorilar'] },
    ],
  },
  {
    id: 'docs', emoji: '📄', icon: 'doc', color: '#e7e4f4', name: ['Документы', 'Documents', 'Документтер', 'Hujjatlar'],
    subs: [
      { id: 'permit', name: ['Патент, визы', 'Permits & visas', 'Патент, виза', 'Patent, viza'] },
      { id: 'lawyer', name: ['Юристы', 'Lawyers', 'Юристтер', 'Yuristlar'] },
      { id: 'translate', name: ['Переводы', 'Translation', 'Котормо', 'Tarjima'] },
    ],
  },
  {
    id: 'auto', emoji: '🚗', icon: 'car', color: '#e1e8ee', name: ['Авто', 'Cars', 'Унаа', 'Avto'],
    subs: [
      { id: 'sell', name: ['Продажа', 'For sale', 'Сатуу', 'Sotuv'] },
      { id: 'rent', name: ['Аренда', 'Rental', 'Ижара', 'Ijara'] },
      { id: 'ride', name: ['Такси, попутки', 'Rides', 'Такси', 'Taksi'] },
    ],
  },
  {
    id: 'cargo', emoji: '📦', icon: 'box', color: '#f3e6da', name: ['Посылки', 'Parcels', 'Посылкалар', 'Posilkalar'],
    subs: [
      { id: 'parcel', name: ['Посылки домой', 'Parcels home', 'Үйгө посылка', 'Uyga posilka'] },
      { id: 'moving', name: ['Переезд, грузчики', 'Moving', 'Көчүү, жүк ташуу', 'Koʻchish'] },
      { id: 'tickets', name: ['Авиабилеты', 'Flights', 'Авиабилеттер', 'Aviachiptalar'] },
    ],
  },
  {
    id: 'goods', emoji: '🛍️', icon: 'bag', color: '#e8eedb', name: ['Товары', 'Goods', 'Товарлар', 'Mahsulotlar'],
    subs: [
      { id: 'sell', name: ['Продаю', 'Selling', 'Сатам', 'Sotaman'] },
      { id: 'home', name: ['Товары с родины', 'Goods from home', 'Мекенден товарлар', 'Vatandan mahsulotlar'] },
      { id: 'free', name: ['Отдам даром', 'Free', 'Бекер берем', 'Tekin beraman'] },
    ],
  },
  {
    id: 'people', emoji: '🤝', icon: 'users', color: '#f3e3ea', name: ['Знакомства', 'Community', 'Таанышуу', 'Tanishuv'],
    subs: [
      { id: 'dating', name: ['Знакомства', 'Dating', 'Таанышуу', 'Tanishuv'] },
      { id: 'community', name: ['Землячество', 'Community', 'Жердештер', 'Hamyurtlar'] },
    ],
  },
]

export interface Listing {
  id: string
  owner: string
  country: CountryId
  city: string
  cat: string
  sub: string
  title: string
  desc: string
  price: number | null
  period?: Period
  author: string
  authorAvatar?: string | null
  since: number
  phone: string
  whatsapp: boolean
  createdAt: number
  premium?: boolean
  photo?: string
  photos: string[]
  views: number
  status: 'active' | 'hidden'
  attrs: Record<string, string | number | boolean | string[]>
  mine?: boolean
}

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

export function countryOf(id: CountryId): Country {
  return COUNTRIES.find((c) => c.id === id) ?? COUNTRIES[0]
}

const LOCALE: Record<Currency, string> = { RUB: 'ru-RU', USD: 'en-US', KRW: 'ko-KR' }

export function formatMoney(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(value)
    .replace(/ /g, ' ')
}
