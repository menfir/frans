// Leitner-planning en antwoordcontrole. Pure functies, geen React, geen localStorage.

export type Dir = 'frnl' | 'nlfr'
export const DIRS: Dir[] = ['frnl', 'nlfr']

export type Card = {
  fr: string
  nl: string
  week: string // label, bv. "2026-W36" — alleen om te filteren en te delen
  box: Record<Dir, number> // 0 = nog nooit gezien, daarna 1..7
  due: Record<Dir, number> // epoch ms
}

/** Eén te overhoren item: een kaart in één richting. */
export type Item = { card: Card; dir: Dir }

const DAY = 86_400_000
/** Interval per box, in dagen. Index = box. Box 0 bestaat niet als wachttijd. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32]
export const MAX_BOX = INTERVALS.length - 1

export const SESSION_SIZE = 20
/** Hoeveel van een sessie maximaal herhalingen zijn; de rest wordt met nieuwe items gevuld. */
export const MAX_REVIEWS = 15
/** FR→NL (herkennen) moet deze box halen voor NL→FR (produceren) vrijkomt. */
const PRODUCTION_UNLOCK_BOX = 2

export function newCard(fr: string, nl: string, week: string): Card {
  return { fr, nl, week, box: { frnl: 0, nlfr: 0 }, due: { frnl: 0, nlfr: 0 } }
}

export const question = (item: Item) => (item.dir === 'frnl' ? item.card.fr : item.card.nl)
export const answer = (item: Item) => (item.dir === 'frnl' ? item.card.nl : item.card.fr)

// ---------------------------------------------------------------- normaliseren

// l'/d' plakken aan het woord vast (l'école), de rest staat los.
const ARTICLES = /^(?:[ld]'|(?:le|la|les|un|une|des|du|de|het|een)\s+)/

/** Kleine letters, accenten weg, lidwoord weg, witruimte ingeklapt. */
export function normalize(s: string): string {
  const bare = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.!?;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return bare.replace(ARTICLES, '').trim()
}

/** Zelfde als normalize, maar accenten blijven staan — om "goed op accent na" te herkennen. */
function normalizeKeepAccents(s: string): string {
  const bare = s
    .toLowerCase()
    .replace(/[.!?;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return bare.replace(ARTICLES, '').trim()
}

/** "la maison / le foyer" of "huis, woning" → meerdere aanvaarde antwoorden. */
const variants = (s: string) => s.split(/[/,;]/).map((v) => v.trim()).filter(Boolean)

/** Levenshtein-afstand, afgebroken zodra ze groter dan `max` wordt. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      best = Math.min(best, row[j])
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

export type Grade = 'goed' | 'accent' | 'bijna' | 'fout'

/**
 * 'goed'   — exact (na normaliseren)
 * 'accent' — alleen accenten verschillen; telt als goed, maar we tonen de juiste spelling
 * 'bijna'  — één tikfout of spraakherkenningsfoutje; telt als fout, maar zonder terug naar box 1
 * 'fout'   — de rest
 */
export function grade(given: string, expected: string): Grade {
  const got = normalize(given)
  if (!got) return 'fout'
  const options = variants(expected)

  if (options.some((o) => normalize(o) === got)) {
    const exact = options.some((o) => normalizeKeepAccents(o) === normalizeKeepAccents(given))
    return exact ? 'goed' : 'accent'
  }
  // ponytail: afstand 1 volstaat; te ruim en "grand"/"gros" gaan voor elkaar door.
  if (options.some((o) => distance(normalize(o), got, 1) <= 1)) return 'bijna'
  return 'fout'
}

// ------------------------------------------------------------------- planning

/** Nieuwe box + vervaldatum na een antwoord. Muteert niets. */
export function schedule(box: number, g: Grade, now: number): { box: number; due: number } {
  let next: number
  if (g === 'goed' || g === 'accent') next = Math.min(box + 1, MAX_BOX)
  // 'bijna' zakt één box in plaats van heel terug naar 1 — anders is spraakinvoer frustrerend.
  else if (g === 'bijna') next = Math.max(1, box - 1)
  else next = 1
  return { box: next, due: now + INTERVALS[next] * DAY }
}

/** Kaart bijwerken na een antwoord; geeft een nieuwe kaart terug. */
export function applyAnswer(card: Card, dir: Dir, g: Grade, now: number): Card {
  const { box, due } = schedule(card.box[dir], g, now)
  return { ...card, box: { ...card.box, [dir]: box }, due: { ...card.due, [dir]: due } }
}

/** NL→FR komt pas vrij als FR→NL zit ingeslepen: eerst herkennen, dan produceren. */
export const isUnlocked = (card: Card, dir: Dir) =>
  dir === 'frnl' || card.box.frnl >= PRODUCTION_UNLOCK_BOX

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Stelt een oefensessie samen uit de hele woordenschat.
 *
 * Zonder de verdeling herhalingen/nieuw verdrinken de woorden van deze week in de
 * achterstand van alle vorige weken — of komen de oude woorden juist nooit meer aan bod.
 *
 * `week` beperkt tot één week en negeert dan de vervaldatums (blokken voor een toets).
 */
export function buildSession(cards: Card[], now: number, week?: string): Item[] {
  const pool = week ? cards.filter((c) => c.week === week) : cards
  const items = pool.flatMap((card) =>
    DIRS.filter((dir) => isUnlocked(card, dir)).map((dir) => ({ card, dir })),
  )

  if (week) return shuffle(items).slice(0, SESSION_SIZE)

  const reviews = items
    .filter((i) => i.card.box[i.dir] > 0 && i.card.due[i.dir] <= now)
    .sort((a, b) => a.card.due[a.dir] - b.card.due[b.dir]) // meest achterstallig eerst
  const fresh = items
    .filter((i) => i.card.box[i.dir] === 0)
    .sort((a, b) => a.card.week.localeCompare(b.card.week)) // oudste week eerst

  const takeReviews = Math.min(reviews.length, Math.max(MAX_REVIEWS, SESSION_SIZE - fresh.length))
  const picked = [
    ...reviews.slice(0, takeReviews),
    ...fresh.slice(0, SESSION_SIZE - takeReviews),
  ]
  return shuffle(picked)
}

/** Aantallen voor het startscherm. */
export function stats(cards: Card[], now: number) {
  const items = cards.flatMap((card) =>
    DIRS.filter((dir) => isUnlocked(card, dir)).map((dir) => ({ card, dir })),
  )
  return {
    woorden: cards.length,
    teHerhalen: items.filter((i) => i.card.box[i.dir] > 0 && i.card.due[i.dir] <= now).length,
    nieuw: items.filter((i) => i.card.box[i.dir] === 0).length,
  }
}
