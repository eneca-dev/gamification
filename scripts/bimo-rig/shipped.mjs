// Единственный источник правды о том, какая графика реально отгружена в приложение.
// Файлы prompts.json остаются полным художественным архивом, включая выведенные вещи,
// поэтому состав коллекции задаётся здесь, а не перечислением всех промптов.

export const SHIPPED_BACKGROUNDS = ['mint', 'clouds', 'office', 'green-courtyard', 'beach', 'starry-evening']
export const SHIPPED_ACCESSORIES = ['mint-cap', 'blue-headphones', 'starry-scarf']

// Текущая коллекция одежды. Прежний одиночный бомбер остался только в архиве промптов.
export const GARMENT_PROMPTS = 'collection/prompts.json'

// Бесплатный мятный фон отгружается lossless WebP, остальные — PNG.
export const backgroundSrc = (name) => `/bimo/backgrounds-v4/${name === 'mint' ? 'mint.webp' : `${name}.png`}`
