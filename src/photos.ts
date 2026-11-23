// Иллюстрации для баннеров на главной (сгенерированы нейросетью, это не реальные места и люди).
import flat from './photos/flat.jpg'
import warehouse from './photos/warehouse.jpg'
import coffee from './photos/coffee.jpg'
import parcels from './photos/parcels.jpg'
import docs from './photos/docs.jpg'

export const PHOTOS = { flat, warehouse, coffee, parcels, docs }
export type PhotoKey = keyof typeof PHOTOS
