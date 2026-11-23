import { useEffect, useRef, useState } from 'react'
import type { Ctx } from './App'
import { pick } from './i18n'
import { PHOTOS, type PhotoKey } from './photos'

type L4 = [string, string, string, string]

interface Banner {
  id: string
  pic: PhotoKey
  tint: string
  title: L4
  sub: L4
  cta: L4
  cat: string
}

// Баннеры на главной ведут в разделы приложения.
const BANNERS: Banner[] = [
  {
    id: 'housing', pic: 'flat', tint: '#0f6e5a', cat: 'housing',
    title: ['Жильё для своих', 'Housing from our people', 'Өзүбүздүкүлөрдөн турак жай', 'Oʻzimiznikilardan uy-joy'],
    sub: ['Комнаты, койко-места и квартиры', 'Rooms, beds and apartments', 'Бөлмөлөр, орундар, батирлер', 'Xonalar, joylar va kvartiralar'],
    cta: ['Смотреть', 'Browse', 'Көрүү', 'Koʻrish'],
  },
  {
    id: 'work', pic: 'warehouse', tint: '#1d5b8f', cat: 'work',
    title: ['Работа рядом с домом', 'Jobs near you', 'Үйгө жакын жумуш', 'Uyga yaqin ish'],
    sub: ['Вакансии от земляков и работодателей', 'Vacancies from employers and our people', 'Жердештерден жумуш орундары', 'Hamyurtlardan vakansiyalar'],
    cta: ['Найти работу', 'Find a job', 'Жумуш табуу', 'Ish topish'],
  },
  {
    id: 'people', pic: 'coffee', tint: '#8a3a5a', cat: 'people',
    title: ['Знакомства рядом', 'People nearby', 'Жакын жердегилер', 'Yaqin atrofdagilar'],
    sub: ['Анкеты земляков на карте', 'Profiles of people from home on a map', 'Жердештердин анкеталары картада', 'Hamyurtlar anketalari xaritada'],
    cta: ['Открыть', 'Open', 'Ачуу', 'Ochish'],
  },
  {
    id: 'parcels', pic: 'parcels', tint: '#7a3a2a', cat: 'cargo',
    title: ['Посылки на родину', 'Parcels home', 'Мекенге посылкалар', 'Vatanga posilkalar'],
    sub: ['Бишкек, Ош, Ташкент, Самарканд', 'Bishkek, Osh, Tashkent, Samarkand', 'Бишкек, Ош, Ташкент, Самарканд', 'Bishkek, Oʻsh, Toshkent, Samarqand'],
    cta: ['Смотреть', 'Browse', 'Көрүү', 'Koʻrish'],
  },
  {
    id: 'docs', pic: 'docs', tint: '#3b3a7a', cat: 'docs',
    title: ['Патент, визы, переводы', 'Permits, visas, translation', 'Патент, виза, котормо', 'Patent, viza, tarjima'],
    sub: ['Юристы и помощники, которые говорят на вашем языке', 'Lawyers who speak your language', 'Сиздин тилде сүйлөгөн юристтер', 'Sizning tilingizda gaplashadigan yuristlar'],
    cta: ['Подробнее', 'Learn more', 'Кененирээк', 'Batafsil'],
  },
]

const AUTO_MS = 4000

export function BannerCarousel({ ctx }: { ctx: Ctx }) {
  const lang = ctx.prefs.lang
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const touched = useRef(0)

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const n = (i + BANNERS.length) % BANNERS.length
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  // Автопрокрутка: новый баннер каждые 4 секунды, пауза после ручного свайпа.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - touched.current < AUTO_MS * 1.5) return
      go(index + 1)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [index])

  const onScroll = () => {
    const el = track.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(i)
  }

  return (
    <div className="banners">
      <div
        className="banners__track"
        ref={track}
        onScroll={onScroll}
        onTouchStart={() => (touched.current = Date.now())}
        onPointerDown={() => (touched.current = Date.now())}
      >
        {BANNERS.map((b) => (
          <button
            key={b.id}
            className="banner"
            style={{ backgroundImage: `linear-gradient(90deg, ${b.tint}f2 0%, ${b.tint}b3 48%, ${b.tint}00 100%), url(${PHOTOS[b.pic]})` }}
            onClick={() => ctx.push({ type: 'category', cat: b.cat })}
          >
            <b>{pick(lang, b.title)}</b>
            <span className="banner__sub">{pick(lang, b.sub)}</span>
            <span className="banner__cta">{pick(lang, b.cta)}</span>
          </button>
        ))}
      </div>
      <div className="banners__dots">
        {BANNERS.map((b, i) => (
          <button key={b.id} className={i === index ? 'on' : ''} onClick={() => { touched.current = Date.now(); go(i) }} aria-label={String(i + 1)} />
        ))}
      </div>
    </div>
  )
}
